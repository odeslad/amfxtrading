# 064 — Live Day P&L without polling

> Status: **approved**

## Context
Journal › Accounts shows a Day P&L per broker: the net result of the trades closed today (broker day) plus the floating result of the open positions. Today every open Accounts tab asks `GET /balances/daily-pnl` every 5 s, and every request sums today's closed trades in the database for each broker. With 13 brokers that is about 17 000 requests and more than 200 000 database aggregates a day for a single tab left open, for a closed part that only changes when a trade closes. The Profit column beside it is already live: it comes with the `account` WebSocket message every second. This spec makes the Day P&L as live as the Profit and removes the polling.

## Affected layers
- backend · frontend

## User stories
- As a trader, I want the Day P&L to move with the Profit, so that both figures agree at every moment.
- As the operator of the server, I want the Day P&L to cost almost nothing, so that an Accounts tab left open all day does not load the backend and the database.

## Acceptance criteria
- AC 1. WHEN the Accounts tab is open THEN it makes no periodic request for the Day P&L.
- AC 2. WHEN an `account` message arrives for a broker THEN its Day P&L is shown as its closed result of today plus equity minus balance, refreshed at the same moment as the Profit (desktop table and mobile cards).
- AC 3. WHEN the backend stores a history with changes for a broker THEN that broker's closed result of today is recomputed once, and the next `account` messages carry the new value.
- AC 4. WHEN a broker's day rolls over (midnight in broker time) THEN its closed result of today starts again from the trades of the new day without waiting for a new trade.
- AC 5. WHEN the backend restarts THEN each broker's closed result of today is recomputed before it is sent.
- AC 6. WHEN a broker's pipe is not live THEN its row stays inactive and shows no Day P&L, as today.
- AC 7. WHEN the change is deployed THEN the before/after load (requests and database aggregates for the Day P&L per hour with one Accounts tab open) is recorded in `verification.md`.

## Out of scope
- The jump of the Day P&L right after a position closes (the EA writes its history every 60 s, so the trade reaches the closed part up to a minute after it leaves the open part).
- Changing what the Day P&L counts (profit + swap + commission) or the broker day boundary.
- Any change to the EA.
