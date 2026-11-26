# 062 — Mirror entry groups

> Status: **approved**

## Context
An entry placed with a mirror preset (New Trade, or the chart menu's quick orders with a mirror preset selected) sends one command per broker of the preset. Today the resulting positions and orders are independent: changing the SL, TP or order price, or closing them, has to be done broker by broker. This spec links them at creation into a group, marks the group with a coloured star and makes one change apply to the whole group.

## Affected layers
- backend · db · frontend

## User stories
- As a trader, I want the entries of one mirror order to be linked, so that I can see at a glance which positions and orders belong together.
- As a trader, I want to change SL, TP or the pending price of one entry and have the same change applied to every entry of its group, so that I manage the mirror trade once.
- As a trader, I want to take one entry out of its group, so that I can manage it alone.

## Acceptance criteria
- AC 1. WHEN an entry is sent with a mirror preset (New Trade or quick order) to two or more brokers THEN the resulting positions/orders form one group.
- AC 2. WHEN a group is created THEN it gets a star colour assigned automatically from a fixed palette, different from the colours of the other open groups while the palette allows.
- AC 3. WHEN a position or order belongs to a group THEN a star in the group colour appears in its broker column in Positions and Orders (desktop table and mobile card).
- AC 4. WHEN the user changes the SL, TP or the pending price of a grouped entry THEN the same absolute price is sent to every other open entry of the group.
- AC 5. WHEN the user removes the SL or TP of a grouped entry THEN it is removed from every other entry of the group.
- AC 6. WHEN the user closes a grouped position or cancels a grouped order THEN every other entry of the group is closed/cancelled.
- AC 7. WHEN a change fails on one or more brokers THEN the user is told which broker failed and the entries that succeeded keep the change (no rollback).
- AC 8. WHEN a grouped pending order fills THEN the resulting position keeps the group and the star.
- AC 9. WHEN one entry of the group closes on its own (SL/TP hit, manual close outside the app) THEN the remaining entries stay grouped.
- AC 10. WHEN the user takes an entry out of its group THEN its star disappears and later changes to it or to the group no longer propagate between them.
- AC 11. WHEN only one entry of a group remains open THEN it shows no star (a group of one is no group).
- AC 12. WHEN the backend restarts THEN existing groups are preserved.

## Out of scope
- Grouping entries manually after creation, or merging groups.
- Propagating by pip distance instead of the same price.
- Changing lots / partial closes across the group.
- Entries placed directly in MT4.
