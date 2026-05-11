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
                                description: { type: "string" },
                            },
                        },
                    },
                },
                undefined,
                false,
            );

        const taskAssigneeHandles = ref({});
        watch(
            taskObjects,
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

        function taskDescription(task) {
            return task.value.description || "No additional description.";
        }

        // Requires Attention: tasks with status "Needs Review" or "Blocked"
        const requiresAttention = computed(() =>
            taskObjects.value
                .filter(
                    (task) =>
                        task.value.status === "Needs Review" ||
                        task.value.status === "Blocked",
                )
                .sort(
                    (a, b) =>
                        new Date(a.value.deadline) - new Date(b.value.deadline),
                ),
        );

        // Recent Updates: tasks with status "In Progress" or "Completed",
        // sorted by most recent publish time, limited to 5
        const recentUpdates = computed(() =>
            taskObjects.value
                .filter(
                    (task) =>
                        task.value.status === "In Progress" ||
                        task.value.status === "Completed",
                )
                .sort((a, b) => b.value.published - a.value.published)
                .slice(0, 5),
        );

        // Upcoming Deadlines: tasks with deadlines between today and next week
        const upcomingDeadlines = computed(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            return taskObjects.value
                .filter((task) => {
                    const deadline = new Date(task.value.deadline);
                    return deadline >= today && deadline <= nextWeek;
                })
                .sort(
                    (a, b) =>
                        new Date(a.value.deadline) - new Date(b.value.deadline),
                );
        });

        function statusClass(status) {
            const map = {
                "Not Started": "status-not-started",
                "In Progress": "status-in-progress",
                "Needs Review": "status-needs-review",
                Blocked: "status-blocked",
                Completed: "status-completed",
            };
            return map[status] ?? "";
        }

        // Modal state
        const selectedTask = ref(null);
        const isModalOpen = ref(false);

        function openTaskModal(task) {
            selectedTask.value = task;
            isModalOpen.value = true;
        }

        function closeTaskModal() {
            isModalOpen.value = false;
            selectedTask.value = null;
        }

        return {
            tasksLoading,
            requiresAttention,
            recentUpdates,
            upcomingDeadlines,
            taskAssigneeHandles,
            memberHandles,
            statusClass,
            selectedTask,
            isModalOpen,
            openTaskModal,
            closeTaskModal,
            taskDescription,
        };
    },
});
