// src/utils/saveProgress.js
const backendURL = 'https://cellvivor-backend.onrender.com';

function extractChapterIndex(sceneStr) {
  if (!sceneStr) return NaN;
  const match = sceneStr.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : NaN;
}

export async function saveGameProgress(userId, currentChapter) {
  if (!userId || !currentChapter || currentChapter.toString().trim() === '') {
    console.warn('saveGameProgress: Missing or invalid userId or currentChapter');
    return;
  }

  try {
    // Load existing progress to avoid overwriting with a lower chapter (downgrade)
    const loadRes = await fetch(`${backendURL}/progress/load/${userId}`);
    if (loadRes.ok) {
      const data = await loadRes.json();
      const existingScene = data.lastScene;
      const existingIndex = extractChapterIndex(existingScene);
      const newIndex = extractChapterIndex(currentChapter);

      // If both are numeric chapters and the new is lower, skip saving to prevent downgrade
      if (!isNaN(existingIndex) && !isNaN(newIndex) && newIndex < existingIndex) {
        console.log(`Skipping save: existing chapter ${existingIndex} is higher than new ${newIndex}`);
        return;
      }
      // If existingIndex is NaN (unknown) or newIndex >= existingIndex, continue to save
    }

    const res = await fetch(`${backendURL}/progress/save`, {  // Adjust URL if needed
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, scene: currentChapter }),
    });
    if (!res.ok) {
      console.warn('Failed to save progress:', res.statusText);
    } else {
      console.log('Game progress saved:', currentChapter);
    }
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}
