"""Exercise verifier assertions without starting Chromium or importing its CLI."""
import ast
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[1] / 'scripts/verify-instrument-switches.py'
tree = ast.parse(source.read_text(encoding='utf-8'))
names = {'vehicle_sequence', 'mode_sequence', 'off_phases'}
definitions = [node for node in tree.body if
               isinstance(node, ast.FunctionDef) and node.name == 'validate_phase_log' or
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


if __name__ == '__main__':
    unittest.main()
