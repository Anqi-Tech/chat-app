import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import {
    useGraffiti,
    useGraffitiSession,
    useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

export default async () => ({
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
    ),
    setup() {
        const graffiti = useGraffiti();
        const session = useGraffitiSession();
        const router = useRouter();

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
            session,
            true,
        );

        const sortedChats = computed(() =>
            myChats.value.toSorted(
                (a, b) => a.value.published - b.value.published,
            ),
        );

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

        function openChat(chat) {
            router.push(`/chat/${chat.value.channel}`);
        }

        return {
            session,
            sortedChats,
            newChatTitle,
            isCreatingChat,
            createChat,
            openChat,
        };
    },
});
