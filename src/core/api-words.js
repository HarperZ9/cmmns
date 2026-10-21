// The words the radar-core API puts on evidence items: labels, what a sign shows, where it came
// from and what it does not prove. They are the same words the extension's window uses
// (src/ext/signals.js and src/ext/panel.js), kept here so the API needs no DOM and no extension
// code. Every string is stance-neutral and names no account.

export const STRONG_LABEL = { slur: "slur or coded hate term", stereotype: "group stereotype", dehumanise: "dehumanising language", violence: "call for violence", vigilante: "call for vigilantes" };

export const STRONG_MEANING = {
  slur: "A slur, dog whistle or coined term with a documented hateful meaning (ADL Hate Symbols database, Hatebase, GNET, ISD).",
  stereotype: "Names a whole group of people by a trait, such as criminal, lazy or violent.",
  dehumanise: "Describes a group of people as vermin, disease, animals or filth.",
  violence: "Calls for violence or collective punishment against people.",
  vigilante: "Calls for people outside the law, or soldiers, to act against people.",
};

export const FLAG_LABEL = {
  "new-account": "new account", "name-changes": "renamed", "default-handle": "sign-up handle",
  "based-elsewhere": "speaks as local, labelled elsewhere", "same-text": "same text as others", "hate-symbol-name": "hate symbol in name",
  "store-elsewhere": "app store elsewhere", "flag-elsewhere": "flag of another country", "profile-location-elsewhere": "profile says elsewhere",
  "high-volume": "very high post rate", "hours-elsewhere": "active hours fit elsewhere", "fast-replier": "replies within a minute",
  "copied-elsewhere": "same words in other threads", "low-karma": "low karma for its age", "automation-app": "posts through an automation app",
  "no-sleep-gap": "posts around the clock", "repost-only": "almost only reposts", "follow-pattern": "follows many, few follow back",
  "platform-label": "moderation label", "brand-lookalike": "name borrows a brand",
};

export const SRC_RULES = "Radar's own rules, run on this device. Rules and measured error rates: Radar's EVALUATION.md.";
export const SRC_POSTS = "The posts in the input, as given. Radar read them on this device and sent nothing anywhere.";
export const SRC_ACCOUNTS = "Account details given in the input: what each platform discloses on profiles and About pages.";
export const SRC_FILE = "The file's bytes, read on this device: Content Credentials (C2PA) and IPTC or XMP metadata.";

export const STRONG_DOES_NOT_PROVE = "Words can be quoted, ironic or reported speech. This describes the post, not who wrote it or why.";
export const LEAK_DOES_NOT_PROVE = "People quote chatbots, joke, or paste a reply on purpose.";
export const MACHINE_DOES_NOT_PROVE = "No detector reliably tells human from machine writing in a few sentences, and detectors flag non-native English writers more often.";
export const SPAM_DOES_NOT_PROVE = "Real people post giveaways and contact details too. The pattern describes the post, not who sent it.";
export const BURST_DOES_NOT_PROVE = "A post going viral at one moment, or a notification many people get at once, brings replies together too. This describes when the replies arrived, not who sent them or why.";
export const SITE_OWNER_DOES_NOT_PROVE = "Ownership is not editorial control, and Wikidata can lag a sale.";
export const THREAD_LIMIT = "This covers the posts in the input as given, ranked and filtered by the platform before anyone saw them. It names no account and judges no person.";
export const TEXT_LIMIT = "This describes one piece of text. It says nothing about who wrote it, why, or whether it is true.";
