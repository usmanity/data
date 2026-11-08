-- Monthly net worth snapshots. Amounts are integer cents in USD.
-- liabilities_cents is the amount owed as a positive number, so net worth is
-- assets minus liabilities.
CREATE TABLE networth_snapshots (
  month             TEXT PRIMARY KEY      -- "YYYY-MM"
                    CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  assets_cents      INTEGER NOT NULL,
  liabilities_cents INTEGER NOT NULL,
  net_worth_cents   INTEGER GENERATED ALWAYS AS (assets_cents - liabilities_cents) VIRTUAL,
  source            TEXT NOT NULL,      -- e.g. "road-to-10" (historical sheet), "manual"
  note              TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);
