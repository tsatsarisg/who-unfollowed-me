function readFileAsJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(new Error("Invalid JSON file"));
      }
    };
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsText(file);
  });
}

async function processFiles() {
  const followingFileInput = document.getElementById("followingFile");
  const followersFileInput = document.getElementById("followersFile");
  const resultsTitle = document.getElementById("resultsTitle");
  const nonFollowersList = document.getElementById("nonFollowersList");

  if (!followingFileInput.files.length || !followersFileInput.files.length) {
    alert("Please upload both JSON files.");
    return;
  }

  try {
    const followingFile = followingFileInput.files[0];
    const followingData = await readFileAsJSON(followingFile);

    const followersFile = followersFileInput.files[0];
    const followersData = await readFileAsJSON(followersFile);

    const nonFollowers = checkNonFollowers(followingData, followersData);

    resultsTitle.style.display = "block";
    nonFollowersList.style.display = "block";
    nonFollowersList.innerHTML = "";

    if (nonFollowers.length === 0) {
      nonFollowersList.innerHTML =
        "<li>You are followed back by everyone!</li>";
    } else {
      nonFollowers.forEach((follower) => {
        const li = document.createElement("li");
        li.textContent = `@${follower}`;
        nonFollowersList.appendChild(li);
      });
    }
  } catch (error) {
    alert("Error processing files: " + error.message);
  }
}

function checkNonFollowers(followingData, followersData) {
  const followerNames = new Set(
    followersData.map((follower) => follower.string_list_data[0].value)
  );

  const nonFollowers = followingData.relationships_following
    .filter(
      (follower) => !followerNames.has(follower.string_list_data[0].value)
    )
    .map((follower) => follower.string_list_data[0].value);
  return nonFollowers;
}
