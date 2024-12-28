const fs = require("fs");

function checkNonFollowers(followingFile, followersFile, outputFile) {
  try {
    const followersData = JSON.parse(fs.readFileSync(followersFile, "utf-8"));
    const followingData = JSON.parse(fs.readFileSync(followingFile, "utf-8"));

    const followerNames = new Set(
      followersData.map((follower) => follower.string_list_data[0].value)
    );

    const nonFollowers = followingData.relationships_following
      .filter(
        (follower) => !followerNames.has(follower.string_list_data[0].value)
      )
      .map((follower) => follower.string_list_data[0].value);

    console.log("Users you follow who don’t follow you back:");
    nonFollowers.forEach((follower) => console.log(follower));

    fs.writeFileSync(
      outputFile,
      JSON.stringify(nonFollowers, null, 2),
      "utf-8"
    );
    console.log(`Exported ${nonFollowers.length} users to ${outputFile}`);
  } catch (error) {
    console.error("Error reading or processing files:", error.message);
  }
}

const followingFile = "following.json";
const followersFile = "followers.json";
const outputFile = "nonFollowers.json";

checkNonFollowers(followingFile, followersFile, outputFile);
