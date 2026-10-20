import { z } from 'zod';

export function registerMcpPrompts(server) {
  server.prompt(
    'daily_standup_summary',
    'Generate a daily standup summary of what has been accomplished, what is open, and priority items.',
    {},
    () => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Please review my board using the "get_board" and "get_board_stats" tools. Provide a concise daily standup summary with 3 sections:\n1. Completed tasks\n2. Priority open items (starred or urgent)\n3. Suggested next focus items.'
          }
        }]
      };
    }
  );

  server.prompt(
    'plan_project_tasks',
    'Break down a project or goal into a new structured list of actionable todos.',
    {
      goal: z.string().describe('The project or goal description (e.g. "Launch new product website", "Plan corporate retreat")'),
      listName: z.string().optional().describe('Optional name for the new list')
    },
    ({ goal, listName }) => {
      const targetName = listName || goal.slice(0, 40);
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please help me plan the project: "${goal}".\n1. First check if a list named "${targetName}" exists using "list_lists". If not, create it using "create_list".\n2. Break the goal into 5-10 clear, actionable tasks and add them to the list using "add_todo".\n3. Mark the most critical 2-3 items as starred.`
          }
        }]
      };
    }
  );

  server.prompt(
    'organize_notes',
    'Review all notes and documents, summarize their key contents, and suggest improvements or cross-links.',
    {},
    () => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Please inspect all my documents using "list_notes" and "get_note". Provide a structured table of contents with summaries of each document and suggest any missing documentation or ideas to capture.'
          }
        }]
      };
    }
  );
}

