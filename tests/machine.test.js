import test from "node:test";
import assert from "node:assert/strict";
import { machineSigns } from "../src/core/machine.js";

test("a leaked chatbot artifact is strong on its own", () => {
  assert.equal(machineSigns("As an AI language model, I cannot share opinions on the riots.").machineLike, true);
  assert.equal(machineSigns("Certainly! Here is a reply to your tweet about France.").machineLike, true);
});

test("several independent tells in a long reply read as machine-like", () => {
  const t = "Great point! It's important to note that the vibrant tapestry of French society plays a pivotal role here. Moreover, these protests showcase a multifaceted landscape of grievances that resonate deeply — and ultimately, we must navigate the complexities of change. Thoughts?";
  const r = machineSigns(t);
  assert.equal(r.machineLike, true);
  assert.ok(r.signs.length >= 3);
});

test("ordinary short or plain replies are not machine-like", () => {
  for (const t of ["Sounds like you're just coping", "Yeah this was mass murder", "This is from a movie, Evan.",
    "I personally find human injury worse than property destruction, what about you?",
    "I live in Paris and it is strangely peaceful in many areas, and not in others. Limoges is another story, the town hall collapsed and people are losing limbs."]) {
    assert.equal(machineSigns(t).machineLike, false, t);
  }
});

test("one fancy word does not make a writer a machine", () => {
  assert.equal(machineSigns("The landscape of French politics is nuanced and nobody here can predict the next election, honestly, not even the pollsters who keep getting it wrong every single year.").machineLike, false);
});

test("spam patterns", () => {
  assert.ok(machineSigns("Free crypto giveaway, link in bio").spam);
  assert.ok(machineSigns("Lost your funds? I can recover stolen crypto, whatsapp +1 555").spam);
  assert.equal(machineSigns("The giveaway of public land to developers is the real story").spam, null);
});
