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

if __name__ == '__main__':
    unittest.main()
