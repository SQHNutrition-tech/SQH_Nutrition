-- Formulary: feeds and modules stocked by the department.
--
-- Nutrient values are per 100 mL as prepared (liquids, and powders at the
-- standard dilution in g_per_100ml) or per 100 g for modules (basis = '100g').
-- A product can only be used in calculators once a dietitian has checked every
-- value against the pack label and marked it verified. Editing any nutrient
-- value clears the verification.

CREATE TABLE formulas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    maker        TEXT NOT NULL DEFAULT '',
    grp          TEXT NOT NULL CHECK (grp IN ('infant', 'paediatric', 'adult', 'module')),
    category     TEXT NOT NULL DEFAULT '',
    form         TEXT NOT NULL CHECK (form IN ('powder', 'liquid')),
    age          TEXT NOT NULL DEFAULT '',
    pack         TEXT NOT NULL DEFAULT '',
    photo        TEXT NOT NULL DEFAULT '',
    flags        TEXT NOT NULL DEFAULT '',
    notes        TEXT NOT NULL DEFAULT '',
    basis        TEXT NOT NULL DEFAULT '100ml' CHECK (basis IN ('100ml', '100g')),
    kcal         REAL,
    protein      REAL,
    cho          REAL,
    fat          REAL,
    fibre        REAL,
    water        REAL,
    sodium       REAL,
    potassium    REAL,
    phosphate    REAL,
    osmolality   REAL,
    g_per_100ml  REAL,
    scoop_g      REAL,
    source       TEXT NOT NULL DEFAULT '',
    verified_by  TEXT,
    verified_on  TEXT,
    active       INTEGER NOT NULL DEFAULT 1,
    updated_at   TEXT NOT NULL DEFAULT ''
);

-- First batch, from the front-of-pack photos (October 2026). Only values printed
-- on the front are filled in; everything else waits for the nutrition panel.
INSERT INTO formulas (slug, name, maker, grp, category, form, age, pack, photo, flags, notes, kcal, protein, fibre, source) VALUES
('aptamil-advance-2-cesar', 'Aptamil Advance 2 CESAR', 'Nutricia', 'infant', 'Follow-on formula', 'powder', '6–12 months', '800 g', 'aptamil-advance-2-cesar.webp', '', 'Marketed for babies born by C-section.', NULL, NULL, NULL, ''),
('aptamil-ar', 'Aptamil AR', 'Nutricia', 'infant', 'Anti-regurgitation', 'powder', '0–12 months', '400 g', 'aptamil-ar.webp', 'FSMP,Cow''s milk based', 'Food for special medical purposes.', NULL, NULL, NULL, ''),
('aptamil-lactose-free', 'Aptamil Lactose Free', 'Nutricia', 'infant', 'Lactose-free', 'powder', '0–6 months', '400 g', 'aptamil-lactose-free.webp', 'FSMP,Lactose-free,Cow''s milk based', 'Front of pack: DHA/AA, nucleotides. Use under medical supervision.', NULL, NULL, NULL, ''),
('infatrini', 'Infatrini', 'Nutricia', 'infant', 'Energy-dense infant feed', 'liquid', '', '125 mL bottle', 'infatrini.webp', 'Ready to feed', 'Front of pack, per 125 mL: 126 kcal, 3.3 g protein, 0.8 g fibre (FOS). The per-100 mL values are calculated from these.', 100.8, 2.6, 0.6, 'Front of pack (per 125 mL)'),
('monogen', 'Monogen', 'Nutricia', 'paediatric', 'High-MCT, low-LCT', 'powder', '', '400 g', 'monogen.webp', 'FSMP', 'For disorders of long-chain fat metabolism or absorption. Check the label for age range and dilution.', NULL, NULL, NULL, ''),
('neocate-junior', 'Neocate Junior (unflavoured)', 'Nutricia', 'paediatric', 'Amino-acid based', 'powder', '1 year +', '400 g', 'neocate-junior.webp', 'Hypoallergenic,Amino acid', '', NULL, NULL, NULL, ''),
('neocate-syneo', 'Neocate SYNEO', 'Nutricia', 'infant', 'Amino-acid based', 'powder', '0 months +', '400 g', 'neocate-syneo.webp', 'Hypoallergenic,Amino acid,Synbiotics', 'Contains B. breve M-16V, scFOS and lcFOS. Pack warns that preparation differs from other formulas.', NULL, NULL, NULL, ''),
('paediasure-peptide', 'PaediaSure Peptide', 'Abbott', 'paediatric', 'Peptide-based', 'liquid', '8–30 kg (about 1–10 years)', '200 mL bottle', 'paediasure-peptide.webp', 'FSMP,Ready to feed,Tube or sip', 'Vanilla. Front of pack: 1.0 kcal/mL.', 100, NULL, NULL, 'Front of pack (1.0 kcal/mL)'),
('paediasure-plus', 'PaediaSure Plus', 'Abbott', 'paediatric', 'Energy-dense', 'liquid', '8–30 kg (about 1–10 years)', '200 mL bottle', 'paediasure-plus.webp', 'FSMP,Ready to feed,Tube or sip', 'Unflavoured. Front of pack: 1.5 kcal/mL.', 150, NULL, NULL, 'Front of pack (1.5 kcal/mL)'),
('s26-pdf-gold', 'S-26 PDF Gold', 'Wyeth Nutrition', 'infant', 'Post-discharge (preterm)', 'powder', 'Infants over 1800 g', '400 g', 's26-pdf-gold.webp', '', '', NULL, NULL, NULL, ''),
('s26-gold-1', 'S-26 Gold 1', 'Wyeth Nutrition', 'infant', 'Infant formula', 'powder', '0–6 months', '400 g', 's26-gold-1.webp', 'Cow''s milk based', '', NULL, NULL, NULL, ''),
('s26-gold-2', 'S-26 Gold 2', 'Wyeth Nutrition', 'infant', 'Follow-on formula', 'powder', '6–12 months', '400 g', 's26-gold-2.webp', 'Cow''s milk based', '', NULL, NULL, NULL, ''),
('s26-gold-3', 'S-26 Gold 3', 'Wyeth Nutrition', 'paediatric', 'Growing-up formula', 'powder', '1–3 years', '1600 g', 's26-gold-3.webp', 'Cow''s milk based', '', NULL, NULL, NULL, ''),
('s26-lf-gold', 'S-26 LF Gold', 'Wyeth Nutrition', 'infant', 'Lactose-free', 'powder', '0–12 months', '400 g', 's26-lf-gold.webp', 'Lactose-free', '', NULL, NULL, NULL, ''),
('s26-ultima-1', 'S-26 Ultima 1', 'Wyeth Nutrition', 'infant', 'Infant formula', 'powder', '', '400 g', 's26-ultima-1.webp', '', 'Stage 1. Age range not on the front; check the label.', NULL, NULL, NULL, ''),
('similac-high-energy', 'Similac High Energy', 'Abbott', 'infant', 'Energy-dense infant feed', 'liquid', 'Birth to 8 kg (check label)', '200 mL bottle', 'similac-high-energy.webp', 'FSMP,Ready to feed', 'Energy-dense, nutritionally complete formula.', NULL, NULL, NULL, '');
