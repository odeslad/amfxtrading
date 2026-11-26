-- Spec 062: entries placed together with a mirror preset; colour assigned on the second member.
CREATE TABLE "entry_groups" (
    "id" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entry_group_members" (
    "id" SERIAL NOT NULL,
    "group_id" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "ticket" INTEGER NOT NULL,

    CONSTRAINT "entry_group_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "entry_group_members_broker_ticket_key" ON "entry_group_members"("broker", "ticket");
CREATE INDEX "entry_group_members_group_id_idx" ON "entry_group_members"("group_id");

ALTER TABLE "entry_group_members" ADD CONSTRAINT "entry_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "entry_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
