/**
 * Professional Planning Layer – Copilot-Level
 * Builds a clear, actionable plan based on the detected intent.
 */

export function buildPlan(intent, context = {}) {
    const { intent: primaryIntent, summary } = intent;

    const plan = {
        action: primaryIntent,
        summary,
        steps: [],
        tool: null
    };

    switch (primaryIntent) {

        case "modify":
            plan.tool = "file.modify";
            plan.steps = [
                "Identify the exact modification requested from the user's message.",
                "Load the latest version of the file from the session.",
                "Apply the requested modification without generating or assuming missing data.",
                "Return the updated file to the user."
            ];
            break;

        case "generate":
            plan.tool = "file.generate";
            plan.steps = [
                "Determine the type of file the user wants to create (Excel, PDF, Word, JSON, etc.).",
                "Prepare an initial structure for the new file.",
                "Generate the file using the appropriate engine.",
                "Return the newly created file to the user."
            ];
            break;

        case "analyze":
            plan.tool = "file.analyze";
            plan.steps = [
                "Load the latest version of the attached file.",
                "Extract sheets, columns, rows, missing values, inconsistencies, and relationships.",
                "Summarize the findings clearly and accurately.",
                "Return a structured analysis report to the user."
            ];
            break;

        case "convert":
            plan.tool = "file.convert";
            plan.steps = [
                "Load the latest version of the file.",
                "Convert the file to the requested format (Excel → PDF, PDF → Image, Word → PDF, etc.).",
                "Return the converted file to the user."
            ];
            break;

        case "chat":
            plan.tool = null;
            plan.steps = [
                "Respond to the user in a warm, human-like Syrian tone.",
                "Provide guidance, clarification, or support as needed."
            ];
            break;

        default:
            plan.action = "chat";
            plan.tool = null;
            plan.steps = [
                "Ask the user for clarification because the intent is unclear."
            ];
            break;
    }

    return plan;
}
