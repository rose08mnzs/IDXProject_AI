import assert from "node:assert/strict";
import { handleWeek4Conversation } from "../skills/week4Skill";
import { closeDb } from "../../config/db";

async function run() {

    const userId = "week4-user-1";

    try {

        console.log("Running Week 4 Conversation Test...\n");

        const start = await handleWeek4Conversation(
            userId,
            "Find homes in Irvine"
        );

        assert.match(start, /budget/i);
        console.log("✓ Conversation start test passed");

        const budget = await handleWeek4Conversation(
            userId,
            "Under $1.2M"
        );

        assert.match(budget, /bedroom/i);
        console.log("✓ Budget follow-up test passed");

        const beds = await handleWeek4Conversation(
            userId,
            "3 bedrooms"
        );

        assert.match(beds, /bathroom/i);
        console.log("✓ Bedroom follow-up test passed");

        const baths = await handleWeek4Conversation(
            userId,
            "any"
        );

        assert.match(
            baths,
            /single family|condo|townhome|something else/i
        );

        console.log("✓ Bathroom follow-up test passed");

        const type = await handleWeek4Conversation(
            userId,
            "single family"
        );

        assert.ok(
            /here are your top matches|could not find matching homes/i.test(type)
        );

        console.log("✓ Property type test passed");

        const reset = await handleWeek4Conversation(
            userId,
            "reset"
        );

        assert.match(reset, /conversation cleared/i);

        console.log("✓ Reset test passed");

        console.log("\n====================================");
        console.log("✓ ALL WEEK 4 TESTS PASSED");
        console.log("====================================");

    }
    catch (err) {

        console.error("\n✗ WEEK 4 TEST FAILED\n");
        console.error(err);

        process.exitCode = 1;

    }
    finally {

        await closeDb();

    }

}

run();