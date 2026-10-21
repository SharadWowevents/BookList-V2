import { List } from '../models/List.js';
import { Note } from '../models/Note.js';
import { CrmMember } from '../models/CrmMember.js';

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function registerMcpResources(server, authManager) {
  const requireCrm = () => {
    const user = authManager.requireAuth();
    if (user.role !== 'admin' && !user.crm) {
      throw new Error('Permission denied. CRM access required.');
    }
    return user;
  };
  // Complete board resource
  server.resource(
    'current-board',
    'booklist://board',
    async (uri) => {
      const user = authManager.requireAuth();
      const lists = await List.find({ userId: user._id }).sort({ order: 1 });
      const notes = await Note.find({ userId: user._id }).sort({ order: 1 });

      const data = {
        user: { username: user.username, name: user.name },
        lists,
        notes
      };

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
  );

  // Lists overview resource
  server.resource(
    'all-lists',
    'booklist://lists',
    async (uri) => {
      const user = authManager.requireAuth();
      const lists = await List.find({ userId: user._id }).sort({ order: 1 });

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(lists, null, 2)
        }]
      };
    }
  );

  // Notes overview resource
  server.resource(
    'all-notes',
    'booklist://notes',
    async (uri) => {
      const user = authManager.requireAuth();
      const notes = await Note.find({ userId: user._id }).sort({ order: 1 });

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(notes, null, 2)
        }]
      };
    }
  );

  // CRM: All members overview
  server.resource(
    'crm-members',
    'booklist://crm/members',
    async (uri) => {
      requireCrm();
      const members = await CrmMember.find({}).sort({ end: 1, name: 1 });
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(members, null, 2)
        }]
      };
    }
  );

  // CRM: Due and overdue follow-ups
  server.resource(
    'crm-due-followups',
    'booklist://crm/due-followups',
    async (uri) => {
      requireCrm();
      const today = ymd(new Date());
      const members = await CrmMember.find({});
      const dueList = [];

      for (const m of members) {
        for (const f of m.followUps || []) {
          if (!f.done && f.date) {
            const isDueOrOverdue = f.date <= today;
            if (isDueOrOverdue) {
              dueList.push({
                memberId: m.id,
                memberName: m.name,
                mobile: m.mobile,
                plan: m.plan,
                followUpId: f.id,
                date: f.date,
                note: f.note,
                overdue: f.date < today,
                dueToday: f.date === today
              });
            }
          }
        }
      }

      dueList.sort((a, b) => a.date.localeCompare(b.date));

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(dueList, null, 2)
        }]
      };
    }
  );

  // CRM: Real-time statistics
  server.resource(
    'crm-stats',
    'booklist://crm/stats',
    async (uri) => {
      requireCrm();
      const members = await CrmMember.find({});
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = ymd(today);

      const planCounts = {};
      let expiringSoonCount = 0;
      let expiredCount = 0;
      let dueFollowUpsCount = 0;
      let totalSessions = 0;

      for (const m of members) {
        planCounts[m.plan] = (planCounts[m.plan] || 0) + 1;
        totalSessions += (m.sessionCount || 0);

        if (m.end && /^\d{4}-\d{2}-\d{2}$/.test(m.end)) {
          const parts = m.end.split('-').map(Number);
          const endDate = new Date(parts[0], parts[1] - 1, parts[2]);
          const diffDays = Math.round((endDate - today) / 864e5);
          if (diffDays < 0) expiredCount++;
          else if (diffDays <= 30) expiringSoonCount++;
        }

        for (const f of m.followUps || []) {
          if (!f.done && f.date && f.date <= todayStr) {
            dueFollowUpsCount++;
          }
        }
      }

      const stats = {
        totalMembers: members.length,
        planCounts,
        expiringIn30Days: expiringSoonCount,
        expired: expiredCount,
        dueOrOverdueFollowUps: dueFollowUpsCount,
        totalSessionsRecorded: totalSessions
      };

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    }
  );
}

