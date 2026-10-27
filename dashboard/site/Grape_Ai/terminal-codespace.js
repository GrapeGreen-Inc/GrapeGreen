import readline from 'readline';
import { 
  loadWeightsMatrix, 
  receiveRequest, 
  submitTerminalFeedback, 
  setMode,
  getMode 
} from './API.js'; // Points directly to your API.js core file

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Main Interactive Codespace Loop Menu System
 */
async function terminalCodespaceMenu() {
  console.clear();
  console.log("==================================================================");
  console.log("     SLM.js CODESPACE REINFORCEMENT TRAINING CODESPACE SHELL     ");
  console.log("==================================================================");
  console.log(" Loading 30,000 parameter weight configurations from cloud...");
  
  try {
    const syncStatus = await loadWeightsMatrix();
    console.log(` Status: ${syncStatus}`);
  } catch (err) {
    console.log(` Warning: Sync offline, running local array matrix baseline.`);
  }

  // Enforce training environment state values on boot
  setMode(1);
  showCommands();
  promptUser();
}

function showCommands() {
  console.log("\n[AVAILABLE CODESPACE COMMANDS]");
  console.log("  /mode [0|1|2]   - Swap states (0=Off, 1=Train, 2=Prod)");
  console.log("  /win            - Submit positive token mutation reward (+)");
  console.log("  /loss           - Submit negative error penalty correction (-)");
  console.log("  /help           - Reprint command menu prompt values");
  console.log("  /exit           - Save states and exit codespace shell session");
  console.log("  [Any other text] - Send prompt token into plain -> NLP -> FILTER -> SLM");
  console.log("------------------------------------------------------------------");
}

function promptUser() {
  const currentMode = getMode();
  const modeLabel = currentMode === 0 ? "OFF" : currentMode === 1 ? "TRAIN" : "PROD";
  
  rl.question(`[SLM-SHELL] (MODE: ${modeLabel}) > `, async (line) => {
    const input = line.trim();

    if (!input) {
      promptUser();
      return;
    }

    // Parse specific internal structural commands
    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const command = parts[0].toLowerCase();

      switch (command) {
        case '/exit':
          console.log("\nTerminating codespace training session shell. Goodbye!");
          rl.close();
          process.exit(0);
          break;

        case '/help':
          showCommands();
          promptUser();
          break;

        case '/mode':
          const targetMode = parseInt(parts[1]);
          if ([0, 1, 2].includes(targetMode)) {
            setMode(targetMode);
            console.log(`System internal state shift successful to mode parameter value: ${targetMode}`);
          } else {
            console.log("Invalid mode track token. Choose 0 (Off), 1 (Training), or 2 (Prod).");
          }
          promptUser();
          break;

        case '/win':
          console.log("\n[EVALUATION] Registering manual optimization reward step...");
          const winMsg = await submitTerminalFeedback('win');
          console.log(` >> ${winMsg}`);
          promptUser();
          break;

        case '/loss':
          console.log("\n[EVALUATION] Registering manual error correction penalty step...");
          const lossMsg = await submitTerminalFeedback('loss');
          console.log(` >> ${lossMsg}`);
          promptUser();
          break;

        default:
          console.log(`Unknown shell macro modifier sequence tokens: ${command}`);
          promptUser();
          break;
      }
    } else {
      // Pass general prompt strings directly down into execution workflow structures
      console.log("\n--- Pipeline Execution Path Triggered ---");
      try {
        const pipelineOutput = await receiveRequest(input);
        console.log(`\nModel Inference Result:\n${pipelineOutput}\n`);
      } catch (err) {
        console.log(`Pipeline fault error: ${err.message}`);
      }
      promptUser();
    }
  });
}

// Instantiate terminal session process
terminalCodespaceMenu().catch(console.error);
