-- Product photos uploaded from the formulary editor, so a new product needs
-- no code change. Photos are resized in the browser before upload (well under
-- 600 KB). A product's photo column is 'uploaded' when its picture is here.
CREATE TABLE formula_photos (
    formula_id INTEGER PRIMARY KEY REFERENCES formulas (id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    updated_at TEXT NOT NULL
);
