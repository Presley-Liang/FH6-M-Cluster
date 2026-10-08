"""Exercise verifier assertions without starting Chromium or importing its CLI."""
import ast
from pathlib import Path
import unittest
import re

source = Path(__file__).resolve().parents[1] / 'scripts/verify-instrument-switches.py'
tree = ast.parse(source.read_text(encoding='utf-8'))
names = {'vehicle_sequence', 'mode_sequence', 'off_phases', 'meter_selector'}
definitions = [node for node in tree.body if
               isinstance(node, ast.FunctionDef) and node.name in {'validate_phase_log', 'select_themes'} or
               isinstance(node, ast.Assign) and any(
                   isinstance(target, ast.Name) and target.id in names for target in node.targets)]
namespace = {}
exec(compile(ast.Module(body=definitions, type_ignores=[]), str(source), 'exec'), namespace)


class PhaseValidationTests(unittest.TestCase):
    def entries(self, kind):
        return [{'transition': 1, 'kind': kind, 'phase': phase,
                 'settledMeterOpacities': [0, 0, 0]}
                for phase in namespace[kind + '_sequence']]

    def test_complete_vehicle_and_mode(self):
        for kind in ('vehicle', 'mode'):
            result = namespace['validate_phase_log'](self.entries(kind), 1)
            self.assertEqual(len(result[0]['opacityChecks']), 5 if kind == 'vehicle' else 3)

    def test_missing_off_sample_fails(self):
        entries = self.entries('mode')
        entries[0]['settledMeterOpacities'] = None
        with self.assertRaisesRegex(AssertionError, 'missed the settled meter sample'):
            namespace['validate_phase_log'](entries, 1)


    def test_later_meter_visible_fails(self):
        entries = self.entries('vehicle')
        entries[1]['settledMeterOpacities'] = [0, 0, 1]
        with self.assertRaisesRegex(AssertionError, 'left a meter visible'):
            namespace['validate_phase_log'](entries, 1)

    def test_missing_phase_fails(self):
        entries = self.entries('vehicle')
        entries = [entry for entry in entries if entry['phase'] != 'vehicle-blackout']
        with self.assertRaisesRegex(AssertionError, 'phase order mismatch'):
            namespace['validate_phase_log'](entries, 1)

    def test_every_requested_theme_must_be_outgoing(self):
        entries = self.entries('vehicle')
        for entry in entries:
            entry['theme'] = 'one'
        namespace['validate_phase_log'](entries, 1, ['one'])
        with self.assertRaisesRegex(AssertionError, 'Missing outgoing vehicle coverage'):
            namespace['validate_phase_log'](entries, 1, ['one', 'two'])


class ThemeSelectionTests(unittest.TestCase):
    available = [('one', '.one'), ('two', '.two')]

    def test_default_and_exact_selection(self):
        self.assertEqual(namespace['select_themes'](self.available), self.available)
        self.assertEqual(namespace['select_themes'](self.available, ['two']), [('two', '.two')])

    def test_unknown_id_fails_alone_and_with_valid_id(self):
        for requested in (['typo'], ['one', 'typo']):
            with self.assertRaisesRegex(ValueError, 'Unknown theme IDs: typo'):
                namespace['select_themes'](self.available, requested)

    def test_samples_include_shared_readout_contract(self):
        css = (source.parents[1] / 'public/css/modern-instrument-common.css').read_text(encoding='utf-8')
        contract = re.search(r'\.next-instrument :is\(([^)]+)\)\{opacity:0;transition:', css)
        self.assertIsNotNone(contract)
        sampled = set(namespace['meter_selector'].split(','))
        for selector in contract.group(1).split(','):
            self.assertIn(selector, sampled)
        observer = next(node.args[0].value for node in ast.walk(tree)
                        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                        and node.func.attr == 'evaluate' and node.args
                        and isinstance(node.args[0], ast.Constant)
                        and isinstance(node.args[0].value, str)
                        and node.args[0].value.startswith('meterSelector=>{'))
        self.assertNotIn('meterOpacities:readOpacities()', observer)
        self.assertLess(observer.index('setTimeout('), observer.index('entry.meterOpacities=readOpacities();'))

completion_source = source.with_name('verify-instrument-completion.py')
completion_tree = ast.parse(completion_source.read_text(encoding='utf-8'))
completion_definitions = [node for node in completion_tree.body if
    isinstance(node, ast.FunctionDef) and node.name == 'validate_css_phase' or
    isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and
        target.id == 'meter_selector' for target in node.targets)]
completion_namespace = {}
exec(compile(ast.Module(body=completion_definitions, type_ignores=[]), str(completion_source), 'exec'), completion_namespace)

class CompletionValidationTests(unittest.TestCase):
    def test_all_meters_must_relight(self):
        validate = completion_namespace['validate_css_phase']
        validate({'phase': 'live', 'speedOpacity': 1, 'meterOpacities': [1, 1]})
        for values in ([1, 0], []):
            with self.assertRaises(AssertionError):
                validate({'phase': 'live', 'speedOpacity': 1, 'meterOpacities': values})
        with self.assertRaises(AssertionError):
            validate({'phase': 'off-center', 'speedOpacity': 0, 'meterOpacities': [0, 1]})

    def test_completion_samples_same_meter_contract(self):
        self.assertEqual(set(completion_namespace['meter_selector'].split(',')),
                         set(namespace['meter_selector'].split(',')))
        self.assertIn('[data-heritage-drive-meter]', completion_namespace['meter_selector'])

    def test_europe_verifier_uses_same_assertions_and_sampling(self):
        europe_source = source.with_name('verify-europe-instruments.py')
        europe_tree = ast.parse(europe_source.read_text(encoding='utf-8'))
        for name in ('meter_selector', 'validate_css_phase'):
            def find(nodes):
                return next(node for node in nodes if
                    isinstance(node, ast.FunctionDef) and node.name == name or
                    isinstance(node, ast.Assign) and any(isinstance(target, ast.Name)
                        and target.id == name for target in node.targets))
            self.assertEqual(ast.dump(find(europe_tree.body)), ast.dump(find(completion_tree.body)))

    def test_all_verifier_text_io_is_utf8(self):
        for script in source.parent.glob('verify-*.py'):
            for node in ast.walk(ast.parse(script.read_text(encoding='utf-8'))):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in ('check_output', 'read_text', 'write_text'):
                    encoding = next((kw.value for kw in node.keywords if kw.arg == 'encoding'), None)
                    self.assertIsInstance(encoding, ast.Constant, str(script))
                    self.assertEqual(encoding.value, 'utf-8', str(script))

if __name__ == '__main__':
    unittest.main()
