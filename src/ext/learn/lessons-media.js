// Lessons for the media checks CMMNS runs on click (src/core/mediacheck.js): Content Credentials
// and AI-generation metadata. Examples describe made-up files.

export const MEDIA_LESSONS = [
  {
    id: "c2pa", title: "Content Credentials", research: [],
    what: "Content Credentials are signed records inside a picture or a video. The camera or the editing tool writes them (the C2PA standard). They can say which tool made the file, who signed it, and if generative AI made it.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A photo of a burning building whose credentials, signed by an image generator, say it was made with generative AI." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A match photo whose credentials say it came from a news agency's camera and was cropped in an editor." },
    ],
    why: "A realistic picture can end an argument faster than any sentence. Credentials let a file carry its own history. A reader can see how someone made it and compare the caption with that history.",
    spot: "Upload the file to a Content Credentials viewer, such as the one at contentcredentials.org. Or look for the small \"CR\" mark that some sites show on images.",
    counter: "Read who signed and which tool they used. A signature tells you who vouches for the file. Check the scene against the caption as a separate step.",
    dnp: "Credentials record what the signing tool declared. A valid signature shows who signed and that the file is unchanged since. The truth of the scene is a separate check.",
  },
  {
    id: "c2pa-changed", title: "Credentials do not match", research: [],
    what: "This sign finds a file with Content Credentials where at least one check failed. The check can be the signature, a recorded hash, or the hash that ties the credentials to the file's bytes.",
    examples: [
      { side: "none", topic: "elections", kind: "sign", text: "A photo of a crowd whose credentials still describe the original picture, while the file's bytes have since changed." },
      { side: "none", topic: "local", kind: "ordinary", text: "A council photo that a site re-compressed on upload, which broke the binding without anyone meaning to." },
    ],
    why: "When the credentials and the file disagree, the file changed after someone signed it. That can be honest processing. It can also be an edit that someone hoped the old credentials would cover.",
    spot: "A Content Credentials viewer shows which check failed. Then find the earliest copy of the image with a reverse image search, and compare the two.",
    counter: "Treat the old credentials as a story about an earlier file. Find that earlier file if you can. Judge the picture you have on its own.",
    dnp: "Editing tools and platforms often break credentials by accident, in ordinary cropping and upload.",
  },
  {
    id: "ai-metadata", title: "AI-generation metadata", research: [],
    what: "This sign finds plain notes inside the file that say an AI tool made it. The note can be an IPTC digital source type, an image generator's settings, or a software field that names a generator.",
    examples: [
      { side: "none", topic: "climate", kind: "sign", text: "A dramatic flood photo whose metadata lists the prompt and settings of an image generator." },
      { side: "none", topic: "tech", kind: "ordinary", text: "An illustration on a tech blog, labelled as AI art in the caption and in the metadata." },
    ],
    why: "Many generators write a note into the file by default, and many uploaders leave it in. It is often the fastest clue that someone generated a realistic picture instead of a photograph.",
    spot: "Open the file's details in an image viewer or a metadata tool. Look for the software field or a digital source type.",
    counter: "Use the note as a strong hint, and keep checking. Before you share the picture, look for the scene from other sources, at the same place and time.",
    dnp: "Metadata is plain text in the file: anyone can add, copy or remove it.",
  },
  {
    id: "image-text", title: "Words inside a picture", research: [],
    what: "This sign finds a claim posted as a picture: a screenshot, a cropped headline or a caption burned into an image. When you click, CMMNS reads the words on your device. Then it runs the same checks as on a post's own text.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "A screenshot of a made-up headline about a cure, posted as an image so that searches for its words come up empty." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A photo of a stadium scoreboard shared after a match, with the final score in the picture." },
    ],
    why: "Text in a picture escapes search, fact-check matching and most filters. A screenshot looks like a record, even when someone made up the original. People also post claims as images for honest reasons: it is quick and it keeps the layout.",
    spot: "Ask where the words in the picture first appeared. Search for a distinctive phrase from it. Look for the post or the article that the screenshot claims to show, on the site that it names.",
    counter: "Read the words as a claim that someone said them. Search for the original. Until you find it, treat the screenshot as unconfirmed, and say so if you share it.",
    dnp: "The software can misread a word, and someone can edit a screenshot. The sign is about the words that CMMNS read from the picture. Find the original post to learn who wrote them.",
  },
];
