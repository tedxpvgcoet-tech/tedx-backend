import { Octokit } from "@octokit/rest";
import { Buffer } from "buffer";
import dotenv from "dotenv";
dotenv.config();

const appendToJsonFile = async ({
  path,
  newEntry,
  message,
}) => {
  const owner = "tedxpvgcoet-tech"
  const repo = "mailing-system"
  const token = process.env.GITHUB_PAT;
  const octokit = new Octokit({ auth: token });

  try {
    const { data: file } = await octokit.repos.getContent({ owner, repo, path });

    const content = Buffer.from(file.content, "base64").toString();
    const jsonArray = JSON.parse(content);
    const emailExists = jsonArray.some(entry => entry.email === newEntry.email);

    if (emailExists) {
      console.log("Email already exists in the JSON file");
      return;
    }

    jsonArray.push(newEntry);

    const updatedContent = Buffer.from(
      JSON.stringify(jsonArray, null, 2)
    ).toString("base64");

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: updatedContent,
      sha: file.sha
    });

    console.log(`✅ File updated: ${response.data.commit.html_url}`);
  } catch (err) {
    console.error("❌ Error updating file:", err.message);
  }

  const { data: rateLimit } = await octokit.rateLimit.get();
  console.log(rateLimit.rate);
};

export async function addSubscriber(newSubscriber) {
  await appendToJsonFile({
    path: "data/mailing_list.json",
    newEntry: newSubscriber,
    message: "Add new subscriber"
  });
}

// Add two more functions using appendToJsonFile as a helper function, name them as addSpeaker and addSponsor after the iput fields of forms are finalized