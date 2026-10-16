-- Formulary: bottle size (so the hub can show values per bottle as well as
-- per 100 mL), more electrolytes, and osmolarity alongside osmolality.
-- serving_ml is the volume of one bottle, carton or pack as sold (liquids).
ALTER TABLE formulas ADD COLUMN serving_ml REAL;
ALTER TABLE formulas ADD COLUMN chloride REAL;
ALTER TABLE formulas ADD COLUMN calcium REAL;
ALTER TABLE formulas ADD COLUMN magnesium REAL;
ALTER TABLE formulas ADD COLUMN osmolarity REAL;

-- Bottle sizes printed on the packs already in the formulary.
UPDATE formulas SET serving_ml = 125 WHERE slug IN ('infatrini', 'fortimel-compact-protein', 'renilon-7-5', 'paediasure-compact');
UPDATE formulas SET serving_ml = 200 WHERE slug IN ('paediasure-peptide', 'paediasure-plus', 'similac-high-energy', 'fortisip', 'diasip', 'vital-1-5', 'fortini');
UPDATE formulas SET serving_ml = 220 WHERE slug IN ('glucerna-advance', 'glucerna-sr', 'nepro-hp');
UPDATE formulas SET serving_ml = 237 WHERE slug = 'ensure-clear';
UPDATE formulas SET serving_ml = 250 WHERE slug = 'ensure-vanilla';
UPDATE formulas SET serving_ml = 330 WHERE slug = 'ensure-max-protein';
UPDATE formulas SET serving_ml = 118 WHERE slug = 'ensure-compact';
UPDATE formulas SET serving_ml = 500 WHERE slug IN ('ensure-plus-advance', 'nutrison-concentrated');
UPDATE formulas SET serving_ml = 1000 WHERE slug IN ('nutrison-energy', 'nutrison-protein-plus-multi-fibre', 'glucerna-1-5', 'diason-energy-hp');
UPDATE formulas SET serving_ml = 1500 WHERE slug = 'jevity-1-5';
