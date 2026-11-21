Hey team! 

For **v1.11**, our main goal is scaling **Grape Ai** from 108k up to **~250k parameters**. My current laptop doesn't have enough GPU/VRAM to run the browser trainer smoothly, so I need someone with a stronger GPU to run a quick **5-epoch** training session and PR the exported weights back into the **v1.11** branch. 

#### What's Already Prepped

* The .html browser trainer
* Training dataset (prompt-response pairs, wiki articles, and code snippets)

#### Exact Training Settings to Use

* **Target Model Size:** ~250k parameters
* **Epochs:** 5
* **Learning Rate:** 0.003
* **Validation Fraction:** 0.2

#### Quick Tips Before Running

* Open the .html trainer in **Chrome or Edge** with **Hardware Acceleration enabled** (chrome://settings/system) so WebGL uses your GPU.
* Keep the browser tab active/visible while it trains so the browser doesn't throttle background tabs.
* Watch the validation loss across the 5 epochs just to make sure it converges cleanly without overfitting.

Once it finishes, export the trained weights file and open a Pull Request targeting **v1.11**! 

– GreatGamesGuy67
