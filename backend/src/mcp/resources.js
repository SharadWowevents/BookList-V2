import { List } from '../models/List.js';
import { Note } from '../models/Note.js';

export function registerMcpResources(server, authManager) {
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
}

