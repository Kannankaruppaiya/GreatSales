-- When each reminder letter actually went out.
--
-- `Payment` recorded the chase as four booleans and nothing else, so the only
-- question the data could answer was "has the second letter gone?" — never
-- "when did it go?". A collector deciding whether to send the third one needs
-- the second one's date: sent yesterday means wait, sent three weeks ago means
-- send. The row could not tell them, and neither could the UI, which is why it
-- rendered four unlabelled chips and left the judgement to memory.
--
-- Nullable and unbackfilled on purpose. Letters already marked sent went out on
-- a date nobody wrote down, and inventing one — createdAt, updatedAt, today —
-- would put a number on the screen that reads as fact and is not. They stay
-- empty and the UI says "sent" with no date; every letter from here on carries
-- one, stamped by the API when the flag flips.

ALTER TABLE "Payment"
  ADD COLUMN "mail1At" TIMESTAMP(3),
  ADD COLUMN "mail2At" TIMESTAMP(3),
  ADD COLUMN "mail3At" TIMESTAMP(3),
  ADD COLUMN "mail4At" TIMESTAMP(3);
