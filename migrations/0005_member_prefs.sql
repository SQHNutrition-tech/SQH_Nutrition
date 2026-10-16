-- Interface language per member (English or Arabic), and whether they have
-- seen the first-visit welcome on the home page.
ALTER TABLE members ADD COLUMN lang TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'ar'));
ALTER TABLE members ADD COLUMN welcomed INTEGER NOT NULL DEFAULT 0;
