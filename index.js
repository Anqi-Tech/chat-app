import { createApp, ref, computed } from "vue";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import {
    GraffitiPlugin,
    useGraffiti,
    useGraffitiSession,
    useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

function setup() {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    // Navigation state
    // currentChat = null means we're not on any chat yet
    const currentChat = ref(null);

    // My Chats
    // Chats are posted to the user's own actor ID channel with allowed: []
    // so only they can see them.
    const { objects: myChats } = useGraffitiDiscover(
        () => (session.value ? [session.value.actor] : []),
        {
            properties: {
                value: {
                    required: [
                        "activity",
                        "type",
                        "title",
                        "channel",
                        "published",
                    ],
                    properties: {
                        activity: { type: "string", const: "Create" },
                        type: { type: "string", const: "Chat" },
                        title: { type: "string" },
                        channel: { type: "string" },
                        published: { type: "number" },
                    },
                },
            },
        },
        session, // pass session so it can access your private objects
        true,
    );

    const sortedChats = computed(() =>
        myChats.value.toSorted((a, b) => a.value.published - b.value.published),
    );

    // Create Chat
    const newChatTitle = ref("");
    const isCreatingChat = ref(false);

    async function createChat() {
        if (!newChatTitle.value.trim()) return;
        isCreatingChat.value = true;
        try {
            await graffiti.post(
                {
                    value: {
                        activity: "Create",
                        type: "Chat",
                        title: newChatTitle.value.trim(),
                        channel: crypto.randomUUID(),
                        published: Date.now(),
                    },
                    channels: [session.value.actor],
                    allowed: [],
                },
                session.value,
            );
            newChatTitle.value = "";
        } finally {
            isCreatingChat.value = false;
        }
    }

    // Messages
    const chatChannel = computed(() =>
        currentChat.value ? [currentChat.value.value.channel] : [],
    );

    const { objects: messageObjects, isFirstPoll: messagesLoading } =
        useGraffitiDiscover(
            chatChannel,
            {
                properties: {
                    value: {
                        required: ["type", "content", "published"],
                        properties: {
                            type: { type: "string", const: "Message" },
                            content: { type: "string" },
                            published: { type: "number" },
                        },
                    },
                },
            },
            undefined,
            true,
        );

    const sortedMessages = computed(() =>
        messageObjects.value.toSorted(
            (a, b) => a.value.published - b.value.published,
        ),
    );

    const myMessage = ref("");
    const isSendingMessage = ref(false);

    async function sendMessage() {
        if (!myMessage.value.trim() || !currentChat.value) return;
        isSendingMessage.value = true;
        try {
            await graffiti.post(
                {
                    value: {
                        type: "Message",
                        content: myMessage.value.trim(),
                        published: Date.now(),
                    },
                    channels: [currentChat.value.value.channel],
                },
                session.value,
            );
            myMessage.value = "";
        } finally {
            isSendingMessage.value = false;
        }
    }

    async function deleteMessage(message) {
        await graffiti.delete(message, session.value);
    }

    // Tasks
    const { objects: taskObjects, isFirstPoll: tasksLoading } =
        useGraffitiDiscover(
            chatChannel,
            {
                properties: {
                    value: {
                        required: [
                            "type",
                            "title",
                            "deadline",
                            "assignees",
                            "status",
                            "published",
                        ],
                        properties: {
                            type: { type: "string", const: "Task" },
                            title: { type: "string" },
                            deadline: { type: "string" },
                            assignees: { type: "array" },
                            status: { type: "string" },
                            published: { type: "number" },
                        },
                    },
                },
            },
            undefined,
            true,
        );

    const sortedTasks = computed(() =>
        taskObjects.value.toSorted(
            (a, b) => a.value.published - b.value.published,
        ),
    );

    const showTaskForm = ref(false);
    const newTask = ref({
        title: "",
        deadline: "",
        assignees: "",
        description: "",
    });
    const isCreatingTask = ref(false);
    const createTaskLabel = computed(() =>
        isCreatingTask.value ? "Creating..." : "Create Task",
    );

    async function createTask() {
        if (!newTask.value.title.trim() || !newTask.value.deadline) return;
        isCreatingTask.value = true;
        try {
            const assigneeList = newTask.value.assignees
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            await graffiti.post(
                {
                    value: {
                        type: "Task",
                        title: newTask.value.title.trim(),
                        deadline: newTask.value.deadline,
                        assignees: assigneeList,
                        status: "Not Started",
                        description: newTask.value.description.trim(),
                        published: Date.now(),
                    },
                    channels: [currentChat.value.value.channel],
                },
                session.value,
            );
            newTask.value = {
                title: "",
                deadline: "",
                assignees: "",
                description: "",
            };
            showTaskForm.value = false;
        } finally {
            isCreatingTask.value = false;
        }
    }

    function joinAssignees(assignees) {
        return assignees.join(", ") || "None";
    }

    // To update task status, delete the old task object and repost with the new status
    async function updateTaskStatus(task, newStatus) {
        const updated = { ...task.value, status: newStatus };
        await graffiti.delete(task, session.value);
        await graffiti.post(
            {
                value: updated,
                channels: [currentChat.value.value.channel],
            },
            session.value,
        );
    }

    // Navigation helpers
    function openChat(chat) {
        currentChat.value = chat;
    }

    function goBackToChats() {
        currentChat.value = null;
    }

    return {
        session,
        sortedChats,
        newChatTitle,
        isCreatingChat,
        createChat,
        currentChat,
        openChat,
        goBackToChats,
        sortedMessages,
        messagesLoading,
        myMessage,
        isSendingMessage,
        sendMessage,
        deleteMessage,
        sortedTasks,
        tasksLoading,
        showTaskForm,
        newTask,
        isCreatingTask,
        createTaskLabel,
        createTask,
        updateTaskStatus,
        joinAssignees,
    };
}

const App = { template: "#template", setup };

createApp(App)
    .use(GraffitiPlugin, {
        graffiti: new GraffitiDecentralized(),
    })
    .mount("#app");
