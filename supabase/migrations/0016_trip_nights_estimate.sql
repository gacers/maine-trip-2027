-- An estimated trip length in nights, for when exact dates aren't
-- locked in yet (no start/end date to compute a real length from). A
-- price field's own text usually states an explicit "$X/night" or
-- "$X for Y nights" breakdown, but when it's just a lone total with
-- neither, this estimate lets the site still compute a useful avg/
-- night figure instead of giving up (see lib/fieldTypes/price.ts).
alter table trips add column if not exists nights_estimate integer;
