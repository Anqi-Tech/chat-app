import { ref, computed, watch } from "vue";
import {
    useGraffiti,
    useGraffitiSession,
    useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

export default async () => ({
    props: ["chatId"],
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
    ),
    setup(props) {
        const graffiti = useGraffiti();
        const session = useGraffitiSession();

        const chatChannel = computed(() => [props.chatId]);

        // Chat Members
        const { objects: memberObjects } = useGraffitiDiscover(
            chatChannel,
            {
                properties: {
                    value: {
                        required: ["activity", "type", "channel", "published"],
                        properties: {
                            activity: { type: "string", const: "Join" },
                            type: { type: "string", const: "Chat" },
                            channel: { type: "string" },
                            published: { type: "number" },
                        },
                    },
                },
            },
            undefined,
            true,
        );
        const members = computed(() => memberObjects.value.map((m) => m.actor));

        const memberHandles = ref([]);
        watch(
            members,
            async (newMembers) => {
                memberHandles.value = await Promise.all(
                    newMembers.map(async (actor) => ({
                        actor,
                        handle: await graffiti.actorToHandle(actor),
                    })),
                );
            },
            { immediate: true },
        );

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
                                "assignee",
                                "status",
                                "published",
                            ],
                            properties: {
                                type: { type: "string", const: "Task" },
                                title: { type: "string" },
                                deadline: { type: "string" },
                                assignee: { type: "string" },
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
            assignee: "",
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
                const assigneeList = newTask.value.assignee;
                await graffiti.post(
                    {
                        value: {
                            type: "Task",
                            title: newTask.value.title.trim(),
                            deadline: newTask.value.deadline,
                            assignee: assigneeList,
                            status: "Not Started",
                            description: newTask.value.description.trim(),
                            published: Date.now(),
                        },
                        channels: [props.chatId],
                    },
                    session.value,
                );
                newTask.value = {
                    title: "",
                    deadline: "",
                    assignee: "",
                    description: "",
                };
                showTaskForm.value = false;
            } finally {
                isCreatingTask.value = false;
            }
        }

        async function updateTaskStatus(task, newStatus) {
            const updated = { ...task.value, status: newStatus };
            await graffiti.delete(task, session.value);
            await graffiti.post(
                { value: updated, channels: [props.chatId] },
                session.value,
            );
        }

        function getDescription(description) {
            return description || "No additional description";
        }

        const taskAssigneeHandles = ref({});
        watch(
            sortedTasks,
            async (newTasks) => {
                const entries = await Promise.all(
                    newTasks
                        .filter((t) => t.value.assignee)
                        .map(async (t) => {
                            const handle = await graffiti.actorToHandle(
                                t.value.assignee,
                            );
                            return [t.value.assignee, handle];
                        }),
                );
                taskAssigneeHandles.value = Object.fromEntries(entries);
            },
            { immediate: true },
        );

        return {
            session,
            sortedTasks,
            tasksLoading,
            showTaskForm,
            newTask,
            isCreatingTask,
            createTaskLabel,
            createTask,
            updateTaskStatus,
            getDescription,
            members,
            memberHandles,
            taskAssigneeHandles,
        };
    },
});
