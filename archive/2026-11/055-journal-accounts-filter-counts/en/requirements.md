# 055 — Journal accounts: colour, filter and trade/order counts

> Status: **closed**

## Context
Journal › Accounts lists every broker account (a table on desktop, cards on the phone) with broker, account name, number, balance, equity, P&L and the rest. With many accounts there is no way to narrow the list, nor to group accounts visually, and the list does not say how many positions and pending orders each account has open; that is only visible in the Positions and Orders tabs. Positions and orders already have a colour badge (`position_colors`) that the other journal tabs filter on.

## Affected layers
- db · backend · frontend

## User stories
- As the operator, I want to give each account a colour, so that I can group accounts at a glance.
- As the operator, I want to filter the accounts by broker and by colour, so that I see only the ones I care about.
- As the operator, I want to see how many positions and pending orders each account has open, so that I don't open the other tabs to know it.

## Acceptance criteria
- AC 1. Each account has a colour badge, like the positions' one: a click (tap) moves to the next colour of the same palette, and from the last colour back to none. The colour is saved per broker and is the same on every device.
- AC 2. The Accounts tab has the Filters button and the same Filters side panel as Positions (same design, header, fields and Clear filters button), with two fields: Broker (select, "All Brokers" and the visible brokers) and Color (select, "All Colors" and only the colours some account has).
- AC 3. WHEN I choose a broker THEN only that account is shown.
- AC 4. WHEN I choose a colour THEN only the accounts with that colour are shown.
- AC 5. The Filters button shows that a filter is active, as in Positions. An empty result says "No accounts match the filters".
- AC 6. On desktop the table has a "Trades / Orders" column with the number of open positions and of pending orders of the account (e.g. "3 / 1"), sortable by the number of positions.
- AC 7. On the phone the account card shows "Trades / Orders" in place of "Number"; the number moves to the expanded details.
- AC 8. The counts follow the live positions and orders (they change when a position opens or closes, or an order is placed or cancelled) and respect the visibility settings (hidden symbols are not counted).
- AC 10. (added during task 7) The colour filter of Accounts, Positions and Orders allows several colours: one dot per colour in use, each click selects or clears it, none selected = all colours; an item matches any selected colour.
- AC 9. Hidden brokers (Settings › Visibility) stay hidden, as today.

## Out of scope
- Counts of closed trades (History).
- Using the account colour anywhere else (charts, stats, other tabs).
- Filters by other fields (balance, P&L…).
