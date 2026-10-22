// Lessons for the media checks Radar runs on click (src/core/mediacheck.js): Content Credentials
// and AI-generation metadata. Examples describe made-up files.

export const MEDIA_LESSONS = [
  {
    id: "c2pa", title: "Content Credentials", research: [],
    what: "Signed records inside a picture or video, written by the camera or editing tool (the C2PA standard). They can say which tool made the file, who signed it, and whether generative AI made it.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A photo of a burning building whose credentials, signed by an image generator, say it was made with generative AI." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A match photo whose credentials say it came from a news agency's camera and was cropped in an editor." },
    ],
    why: "A realistic picture settles an argument faster than any sentence. Credentials let a file carry its own history, so a reader can see how it was made without trusting the caption.",
    spot: "Upload the file to a Content Credentials viewer, such as the one at contentcredentials.org, or look for the small \"CR\" mark some sites show on images.",
    counter: "Read who signed and which tool they used. A signature tells you who vouches for the file. It says nothing about whether the scene is what the caption claims.",
    dnp: "Credentials record what the signing tool declared. A valid signature shows who signed and that the file has not changed since, not that what it shows is true.",
  },
  {
    id: "c2pa-changed", title: "Credentials do not match", research: [],
    what: "The file carries Content Credentials, and at least one check failed: the signature, a recorded hash, or the hash that ties the credentials to the file's bytes.",
    examples: [
      { side: "none", topic: "elections", kind: "sign", text: "A photo of a crowd whose credentials still describe the original picture, while the file's bytes no longer match them." },
      { side: "none", topic: "local", kind: "ordinary", text: "A council photo that a site re-compressed on upload, which broke the binding without anyone meaning to." },
    ],
    why: "When the credentials and the file disagree, the file changed after it was signed. That can be honest processing, or an edit that someone hoped the old credentials would cover.",
    spot: "A Content Credentials viewer shows which check failed. Then look for the earliest copy of the image with a reverse image search and compare the two.",
    counter: "Treat the old credentials as a story about an earlier file. Find that earlier file if you can, and judge the picture you have on its own.",
    dnp: "Editing tools and platforms can break credentials without any intent to mislead.",
  },
  {
    id: "ai-metadata", title: "AI-generation metadata", research: [],
    what: "Unsigned notes inside the file say an AI tool made it: an IPTC digital source type, an image generator's settings, or a software field naming one.",
    examples: [
      { side: "none", topic: "climate", kind: "sign", text: "A dramatic flood photo whose metadata lists the prompt and settings of an image generator." },
      { side: "none", topic: "tech", kind: "ordinary", text: "An illustration on a tech blog, labelled as AI art in the caption and in the metadata." },
    ],
    why: "Many generators write a note into the file by default, and many uploaders never remove it. It is often the quickest clue that a realistic picture was made, not taken.",
    spot: "Open the file's details in an image viewer or a metadata tool and look for the software field or a digital source type.",
    counter: "Use it as a strong hint and keep checking. Look for the scene from other sources, at the same place and time, before you share it.",
    dnp: "Metadata is unsigned: anyone can add, copy or remove it.",
  },
  {
    id: "image-text", title: "Words inside a picture", research: [],
    what: "A claim posted as a screenshot, a cropped headline or a caption burned into an image. Radar can read the words on your device when you click, and runs the same checks on them as on a post's own text.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "A screenshot of a made-up headline about a cure, posted as an image so that searches for its words find nothing." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A photo of a stadium scoreboard shared after a match, with the final score in the picture." },
    ],
    why: "Text in a picture escapes search, fact-check matching and most filters, and a screenshot looks like a record even when nothing stands behind it. Posting a claim as an image is common for honest reasons too: it is quick and keeps the layout.",
    spot: "Ask where the words in the picture first appeared. Search for a distinctive phrase from it, and look for the post or article the screenshot claims to show, on the site that supposedly published it.",
    counter: "Read the words as a claim, not as proof that someone said them. If the original cannot be found, treat the screenshot as unconfirmed, and say so if you share it.",
    dnp: "Software reads the words and can misread them, and a screenshot can be edited. A sign found in an image's text describes the words Radar read, not who wrote them or whether the post in the picture was real.",
  },
];
