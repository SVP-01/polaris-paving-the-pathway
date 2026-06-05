export const ROLE_INFO = {
  mentor: { label: "Mentor", displayName: "[Mentor Name]" },
  mentee: { label: "Mentee", displayName: "[Mentee Name]" }
};

export const SECTIONS = [
  { id: "dashboard", label: "The Issue" },
  { id: "schedule", label: "The Schedule" },
  { id: "pitches", label: "The Pitches" },
  { id: "pieces", label: "The Pieces" },
  { id: "spark", label: "Spark" },
  { id: "shelf", label: "Still Thinking" },
  { id: "map", label: "Exploration Map" },
  { id: "off-record", label: "Off the Record" },
  { id: "archive", label: "Archive" }
];

export const RESOURCE_TYPES = ["video", "article", "podcast", "book", "course"];

export const REACTION_TAGS = [
  "Loved it",
  "Meh",
  "Confusing but interesting",
  "Not for me",
  "Want to go deeper"
];

const SENTIMENT_BY_TAG = {
  "Loved it": "warm",
  "Want to go deeper": "warm",
  Meh: "neutral",
  "Confusing but interesting": "cool",
  "Not for me": "cool"
};

export const LOCAL_KEYS = {
  events: "the-zine:events",
  session: "the-zine:session",
  seen: "the-zine:seen",
  profiles: "the-zine:profiles"
};

export function makeId(prefix = "evt") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function weekStartIso(dateLike = new Date()) {
  const date = new Date(dateLike);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function formatDate(dateLike, options = {}) {
  const date = new Date(dateLike);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options
  }).format(date);
}

export function formatIssueLabel(weekStart) {
  return `Issue ${weekStart.replaceAll("-", ".")}`;
}

export function slugifyTopic(topic) {
  return topic.trim().toLowerCase().replace(/\s+/g, "-");
}

export function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cloneProfiles(source = {}) {
  return {
    mentor: {
      role: "mentor",
      displayName: source.mentor?.displayName || ROLE_INFO.mentor.displayName,
      accent: source.mentor?.accent || "amber"
    },
    mentee: {
      role: "mentee",
      displayName: source.mentee?.displayName || ROLE_INFO.mentee.displayName,
      accent: source.mentee?.accent || "rose"
    }
  };
}

function sortChronologically(list, key = "createdAt", direction = "asc") {
  return [...list].sort((a, b) => {
    const left = new Date(a[key]).getTime();
    const right = new Date(b[key]).getTime();
    return direction === "asc" ? left - right : right - left;
  });
}

function notificationTargets(kind) {
  const both = ["mentor", "mentee"];
  const menteeOnly = ["mentee"];
  const mentorOnly = ["mentor"];

  switch (kind) {
    case "task_added":
    case "task_updated":
    case "task_suggested":
    case "task_suggestion_resolved":
    case "task_completed":
    case "pitch_sent":
    case "pitch_accepted":
    case "pitch_declined":
    case "pitch_completed":
    case "piece_published":
    case "piece_annotated":
    case "piece_shelved":
    case "spark_posted":
    case "cover_published":
    case "question_posted":
    case "answer_posted":
      return both;
    case "piece_reaction_tagged":
    case "resource_reaction_tagged":
      return both;
    case "profile_updated":
      return both;
    default:
      return both;
  }
}

function notificationCopy(event, state) {
  const { payload } = event;
  const mentorName = state.profiles.mentor.displayName;
  const menteeName = state.profiles.mentee.displayName;

  switch (event.kind) {
    case "task_added":
      return {
        title: "Task added",
        body: `${menteeName} added "${payload.title}" to the day list.`
      };
    case "task_updated":
      return {
        title: "Task edited",
        body: `${mentorName} suggested a tweak on "${payload.title || "a task"}".`
      };
    case "task_suggested":
      return {
        title: "Sticky note suggestion",
        body: `${mentorName} left a suggestion on "${payload.taskTitle}".`
      };
    case "task_suggestion_resolved":
      return {
        title: "Suggestion handled",
        body: `${menteeName} ${payload.action === "accept" ? "accepted" : "dismissed"} a task suggestion.`
      };
    case "task_completed":
      return {
        title: "Task stamped done",
        body: `${menteeName} finished "${payload.title}".`
      };
    case "pitch_sent":
      return {
        title: "Pitch landed",
        body: `${mentorName} sent "${payload.title}" as a new resource.`
      };
    case "pitch_accepted":
      return {
        title: "Pitch accepted",
        body: `${menteeName} accepted "${payload.title}" and scheduled it for ${payload.scheduledDate}.`
      };
    case "pitch_declined":
      return {
        title: "Pitch declined",
        body: `${menteeName} declined "${payload.title}".`
      };
    case "pitch_completed":
      return {
        title: "Pitch completed",
        body: `${menteeName} finished "${payload.title}" and tagged a reaction.`
      };
    case "piece_published":
      return {
        title: "Piece published",
        body: `${menteeName} published "${payload.title}".`
      };
    case "piece_annotated":
      return {
        title: "Sticky feedback",
        body: `${mentorName} added feedback to "${payload.title}".`
      };
    case "piece_shelved":
      return {
        title: "Shelf update",
        body: `${payload.isShelved ? "Moved to the shelf" : "Returned from the shelf"}: "${payload.title}".`
      };
    case "spark_posted":
      return {
        title: "Spark posted",
        body: `${menteeName} captured a new spark: "${payload.text.slice(0, 60)}${payload.text.length > 60 ? "…" : ""}".`
      };
    case "cover_published":
      return {
        title: "Cover page published",
        body: `A new cover letter is live for ${formatIssueLabel(payload.weekStart)}.`
      };
    case "question_posted":
      return {
        title: "Off the Record",
        body: `${menteeName} asked a new question.`
      };
    case "answer_posted":
      return {
        title: "Off the Record reply",
        body: `${mentorName} answered a question.`
      };
    case "piece_reaction_tagged":
    case "resource_reaction_tagged":
      return {
        title: "Reaction tagged",
        body: `${menteeName} added "${payload.reactionTag}" to the archive path.`
      };
    case "profile_updated":
      return {
        title: "Profile updated",
        body: "A display name changed in the zine settings."
      };
    default:
      return { title: "Zine update", body: "Something in the archive changed." };
  }
}

function initialProfilesFromEvents(events) {
  const seed = cloneProfiles();
  for (const event of sortChronologically(events)) {
    if (event.kind !== "profile_updated") continue;
    const role = event.payload.role;
    seed[role] = {
      ...seed[role],
      ...event.payload
    };
  }
  return seed;
}

export function buildState(events) {
  const state = {
    profiles: cloneProfiles(),
    tasksById: new Map(),
    pitchesById: new Map(),
    piecesById: new Map(),
    sparks: [],
    qnaById: new Map(),
    coverByWeek: new Map(),
    notifications: [],
    timeline: [],
    topicCounts: new Map(),
    reactionCounts: new Map(),
    rawEvents: sortChronologically(events)
  };

  state.profiles = initialProfilesFromEvents(state.rawEvents);

  const pushNotification = (event, recipientRole) => {
    const copy = notificationCopy(event, state);
    state.notifications.push({
      id: makeId("ntf"),
      recipientRole,
      eventKind: event.kind,
      title: copy.title,
      body: copy.body,
      createdAt: event.createdAt,
      relatedId: event.payload?.id || event.payload?.taskId || event.payload?.pitchId || event.payload?.pieceId || null
    });
  };

  const touchTopics = (topics = [], weight = 1, reactionTag) => {
    for (const topic of topics) {
      if (!topic) continue;
      const slug = slugifyTopic(topic);
      const entry = state.topicCounts.get(slug) || {
        topic,
        slug,
        weight: 0,
        items: [],
        sentiments: { warm: 0, neutral: 0, cool: 0 }
      };
      entry.weight += weight;
      if (reactionTag) {
        const sentiment = SENTIMENT_BY_TAG[reactionTag] || "neutral";
        entry.sentiments[sentiment] += 1;
      }
      state.topicCounts.set(slug, entry);
    }
  };

  const addArchiveEvent = (type, item) => {
    const nextItem = {
      id: item.id || makeId("arc"),
      type,
      createdAt: item.createdAt || item.date || nowIso(),
      weekStart: weekStartIso(item.createdAt || item.date || nowIso()),
      title: item.title || item.text || item.question || "Untitled",
      subtitle: item.subtitle || item.note || item.body || item.answer || "",
      reactionTag: item.reactionTag || null,
      topics: item.topics || item.topicTags || []
    };
    const existingIndex = state.timeline.findIndex((entry) => entry.id === nextItem.id && entry.type === nextItem.type);
    if (existingIndex >= 0) {
      state.timeline[existingIndex] = { ...state.timeline[existingIndex], ...nextItem };
      return;
    }
    state.timeline.push(nextItem);
  };

  for (const event of state.rawEvents) {
    const payload = event.payload || {};
    switch (event.kind) {
      case "profile_updated": {
        const role = payload.role;
        state.profiles[role] = {
          ...state.profiles[role],
          ...payload
        };
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        break;
      }
      case "task_added":
      case "task_updated": {
        const current = state.tasksById.get(payload.id) || {
          id: payload.id,
          date: payload.date || todayIso(),
          title: payload.title || "Untitled task",
          note: payload.note || "",
          status: payload.status || "To Do",
          suggestions: [],
          linkedPitchId: payload.linkedPitchId || null,
          createdAt: payload.createdAt || event.createdAt,
          completedAt: payload.completedAt || null
        };
        state.tasksById.set(payload.id, {
          ...current,
          ...payload,
          suggestions: current.suggestions || []
        });
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        break;
      }
      case "task_suggested": {
        const task = state.tasksById.get(payload.taskId);
        if (task) {
          task.suggestions = [...task.suggestions, {
            id: payload.suggestionId || makeId("sug"),
            text: payload.text,
            status: "open",
            createdAt: event.createdAt,
            authorRole: payload.authorRole || "mentor"
          }];
          state.tasksById.set(task.id, task);
        }
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        break;
      }
      case "task_suggestion_resolved": {
        const task = state.tasksById.get(payload.taskId);
        if (task) {
          task.suggestions = task.suggestions.map((suggestion) =>
            suggestion.id === payload.suggestionId ? { ...suggestion, status: payload.action } : suggestion
          );
          state.tasksById.set(task.id, task);
        }
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        break;
      }
      case "task_completed": {
        const task = state.tasksById.get(payload.id);
        if (task) {
          state.tasksById.set(task.id, {
            ...task,
            status: "Done",
            completedAt: payload.completedAt || event.createdAt
          });
        }
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        break;
      }
      case "pitch_sent":
      case "pitch_accepted":
      case "pitch_declined":
      case "pitch_completed":
      case "pitch_shelved": {
        const current = state.pitchesById.get(payload.id) || {
          id: payload.id,
          title: payload.title || "Untitled pitch",
          url: payload.url || "",
          type: payload.type || "article",
          note: payload.note || "",
          status: "sent",
          topics: payload.topics || [],
          acceptedAt: null,
          scheduledDate: null,
          declinedNote: null,
          completedAt: null,
          reactionTag: null,
          linkedTaskId: null,
          shelf: false,
          createdAt: event.createdAt
        };
        const next = { ...current, ...payload };
        if (event.kind === "pitch_accepted") {
          next.status = "accepted";
          next.acceptedAt = event.createdAt;
          next.scheduledDate = payload.scheduledDate || null;
          next.linkedTaskId = payload.linkedTaskId || next.linkedTaskId;
        }
        if (event.kind === "pitch_declined") {
          next.status = "declined";
          next.declinedNote = payload.declinedNote || "";
        }
        if (event.kind === "pitch_completed") {
          next.status = "completed";
          next.completedAt = payload.completedAt || event.createdAt;
          next.reactionTag = payload.reactionTag || null;
        }
        if (event.kind === "pitch_shelved") {
          next.shelf = payload.isShelved;
        }
        state.pitchesById.set(payload.id, next);
        touchTopics(next.topics, event.kind === "pitch_completed" ? 2 : 1, next.reactionTag);
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        if (event.kind === "pitch_completed") {
          addArchiveEvent("Resource", next);
        }
        break;
      }
      case "piece_published":
      case "piece_annotated":
      case "piece_shelved":
      case "piece_reaction_tagged": {
        const current = state.piecesById.get(payload.id) || {
          id: payload.id,
          title: payload.title || "Untitled piece",
          body: payload.body || "",
          date: payload.date || todayIso(),
          topics: payload.topics || [],
          notes: [],
          shelf: false,
          linkedTaskId: payload.linkedTaskId || null,
          linkedPitchId: payload.linkedPitchId || null,
          reactionTag: null,
          createdAt: event.createdAt
        };
        const next = { ...current, ...payload };
        if (event.kind === "piece_annotated") {
          next.notes = [...current.notes, {
            id: payload.noteId || makeId("note"),
            text: payload.text,
            createdAt: event.createdAt,
            authorRole: payload.authorRole || "mentor"
          }];
        }
        if (event.kind === "piece_shelved") {
          next.shelf = payload.isShelved;
        }
        if (event.kind === "piece_reaction_tagged") {
          next.reactionTag = payload.reactionTag;
        }
        state.piecesById.set(payload.id, next);
        touchTopics(next.topics, event.kind === "piece_published" ? 2 : 1, next.reactionTag);
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        if (event.kind === "piece_published") {
          addArchiveEvent("Piece", next);
        }
        if (event.kind === "piece_reaction_tagged") {
          addArchiveEvent("Piece", next);
        }
        break;
      }
      case "spark_posted": {
        const spark = {
          id: payload.id,
          text: payload.text,
          topics: payload.topics || [],
          createdAt: event.createdAt
        };
        state.sparks.push(spark);
        touchTopics(spark.topics, 1);
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        addArchiveEvent("Spark", spark);
        break;
      }
      case "question_posted":
      case "answer_posted": {
        const current = state.qnaById.get(payload.id) || {
          id: payload.id,
          question: payload.question || "",
          answer: "",
          createdAt: event.createdAt,
          answeredAt: null,
          topics: payload.topics || []
        };
        const next = { ...current, ...payload };
        if (event.kind === "answer_posted") {
          next.answer = payload.answer || "";
          next.answeredAt = event.createdAt;
        }
        state.qnaById.set(payload.id, next);
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        if (event.kind === "answer_posted") {
          addArchiveEvent("Off the Record", next);
        }
        break;
      }
      case "cover_published": {
        state.coverByWeek.set(payload.weekStart, {
          weekStart: payload.weekStart,
          editorLetter: payload.editorLetter || "",
          createdAt: event.createdAt
        });
        pushNotification(event, "mentor");
        pushNotification(event, "mentee");
        addArchiveEvent("Cover", {
          id: makeId("cover"),
          title: formatIssueLabel(payload.weekStart),
          subtitle: payload.editorLetter || "",
          createdAt: event.createdAt,
          weekStart: payload.weekStart,
          topics: []
        });
        break;
      }
      default:
        break;
    }
  }

  const tasks = sortChronologically([...state.tasksById.values()], "date", "asc");
  const pitches = sortChronologically([...state.pitchesById.values()], "createdAt", "desc");
  const pieces = sortChronologically([...state.piecesById.values()], "date", "desc");
  const qna = sortChronologically([...state.qnaById.values()], "createdAt", "desc");
  const covers = sortChronologically([...state.coverByWeek.values()], "weekStart", "desc");
  const notifications = sortChronologically(state.notifications, "createdAt", "desc");
  const timeline = sortChronologically(state.timeline, "createdAt", "desc");

  const archiveByWeek = new Map();
  for (const item of timeline) {
    const entry = archiveByWeek.get(item.weekStart) || [];
    entry.push(item);
    archiveByWeek.set(item.weekStart, entry);
  }

  const topicIndex = [...state.topicCounts.values()]
    .map((entry) => ({
      ...entry,
      bubbleSize: 84 + entry.weight * 18
    }))
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));

  const reactionIndex = {};
  for (const [slug, entry] of state.topicCounts.entries()) {
    reactionIndex[slug] = entry.sentiments;
  }

  return {
    profiles: state.profiles,
    tasks,
    pitches,
    pieces,
    sparks: sortChronologically(state.sparks, "createdAt", "desc"),
    qna,
    covers,
    notifications,
    timeline,
    archiveByWeek,
    topicIndex,
    reactionIndex,
    rawEvents: state.rawEvents
  };
}

export function buildIssueStats(events, weekStart) {
  const week = weekStartIso(weekStart);
  let tasksCompleted = 0;
  let resourcesFinished = 0;
  let piecesWritten = 0;
  let sparksPosted = 0;
  let questionCount = 0;
  let answerCount = 0;

  for (const event of events) {
    const eventWeek = weekStartIso(event.createdAt);
    if (eventWeek !== week) continue;
    if (event.kind === "task_completed") tasksCompleted += 1;
    if (event.kind === "pitch_completed") resourcesFinished += 1;
    if (event.kind === "piece_published") piecesWritten += 1;
    if (event.kind === "spark_posted") sparksPosted += 1;
    if (event.kind === "question_posted") questionCount += 1;
    if (event.kind === "answer_posted") answerCount += 1;
  }

  return { tasksCompleted, resourcesFinished, piecesWritten, sparksPosted, questionCount, answerCount };
}

export function visibleReactionLabel(reactionTag) {
  if (!reactionTag) return "Awaiting reaction";
  return reactionTag;
}
