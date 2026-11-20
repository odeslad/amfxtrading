-- Spec 055: a colour per broker account (Journal › Accounts); no row = no colour.
CREATE TABLE "account_colors" (
    "broker" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "account_colors_pkey" PRIMARY KEY ("broker")
);
