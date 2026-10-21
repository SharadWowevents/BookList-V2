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

  server.prompt(
    'crm_followup_briefing',
    'Generate a comprehensive daily CRM briefing: overdue follow-ups, items due today, and memberships expiring soon.',
    {},
    () => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Please review the CRM using "crm_list_due_followups" and "crm_list_expiring_members". Generate an executive daily briefing with:\n1. Urgent: Overdue follow-ups needing immediate calls or messages\n2. Due today: Scheduled follow-ups for today with context\n3. Expiring soon: Members up for renewal in the next 30 days and suggested outreach strategy.'
          }
        }]
      };
    }
  );

  server.prompt(
    'crm_session_prep',
    'Prepare an agenda and strategic discussion points for an upcoming member session based on historical notes.',
    {
      memberNameOrId: z.string().describe('Name or ID of the CRM member')
    },
    ({ memberNameOrId }) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please prepare for a session with member "${memberNameOrId}".\n1. Find the member using "crm_get_member" or "crm_list_members".\n2. Review their past session history using "crm_list_sessions".\n3. Outline a 3-part meeting agenda (Review of previous action items, Deep dive discussion topics, Next steps/accountability) based on what has been discussed previously.`
          }
        }]
      };
    }
  );

  server.prompt(
    'crm_renewal_outreach',
    'Draft a personalized WhatsApp renewal or check-in message for a member approaching their renewal date.',
    {
      memberNameOrId: z.string().describe('Name or ID of the CRM member')
    },
    ({ memberNameOrId }) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please draft a warm, professional, high-touch renewal outreach message for "${memberNameOrId}".\n1. Fetch the member details with "crm_get_member" and check their plan and end date.\n2. Review their session notes with "crm_list_sessions" to reference specific wins or topics they worked on.\n3. Draft a tailored WhatsApp message acknowledging their journey and inviting them to renew or discuss their next phase.`
          }
        }]
      };
    }
  );
}

