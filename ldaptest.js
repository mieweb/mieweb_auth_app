const axios = require("axios");

async function updateAppId(username, appId) {
  try {
    const response = await axios.post(
      "https://0152-50-221-78-186.ngrok-free.app/api/update-app-id",
      {
        username: username,
        appId: appId,
      }
    );

    console.log("Response:", response.data);
  } catch (error) {
    console.error(
      "Error updating appId:",
      error.response ? error.response.data : error.message
    );
  }
}

// Example usage
updateAppId("ann", "5e1f1b8412c031084307eb3edeaa8f1f");