# Plinko Volume

Choose your Spotify volume with a Plinko drop. Each landing slot sets the volume to its displayed percentage. The Plinko button shows the current volume, including changes made outside the game.

![Plinko Volume](preview.png)

## Features

- Drop a ball by clicking the board, pressing **Enter** or **Space**, or using **Drop Ball**.
- Use **Skip** to finish the current drop immediately.
- See your volume percentage beside the Plinko button.
- Choose 4–14 peg rows and a ball speed from 1–5.
- Customize the ball, peg, and background colors.
- Show or hide slot percentages, and optionally close the game after a drop.
- Enable or disable the replacement controls from the profile menu.

Board and ball graphics are cached during a game. Closing the game stops its animation and clears its close timer.

## Marketplace installation

1. Install **Plinko Volume** from Spicetify Marketplace and reload Spotify.
2. Open your profile menu and choose **Plinko Volume Settings**.
3. Turn on **Enable Plinko Volume** and click **Save**.
4. Click the Plinko button beside the volume percentage to play.

The extension starts disabled on a fresh installation. Disabling it restores Spotify's normal volume controls.

## Manual installation

1. Download [gamblevolume.js](https://raw.githubusercontent.com/A2R14N/spicetify-extensions/main/gamblevolume/gamblevolume.js).
2. Copy it into your Spicetify extensions directory. Find that directory with `spicetify path -e root`.
3. Run:

   ```sh
   spicetify config extensions gamblevolume.js
   spicetify apply
   ```

4. Enable the extension through **Plinko Volume Settings** in the profile menu.

## Settings

Settings are saved locally and shared across Spotify profiles. **Reset** restores the defaults and disables the replacement controls.

Tested in Spotify **1.3.3.264** with Spicetify **2.45.3**.
