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
    components: {
        InviteItem: await import(
            new URL("../components/invite/main.js", import.meta.url)
        ).then((m) => m.default()),
    },
    setup() {
        const graffiti = useGraffiti();
        const session = useGraffitiSession();
        const router = useRouter();

        // My Chats
        // Discovers both created and joined chats — they share the same schema
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

        // Create Chat
        const newChatTitle = ref("");
        const isCreatingChat = ref(false);

        async function createChat() {
            if (!newChatTitle.value.trim()) return;
            isCreatingChat.value = true;
            try {
                const newChannel = crypto.randomUUID();

                await graffiti.post(
                    {
                        value: {
                            activity: "Create",
                            type: "Chat",
                            title: newChatTitle.value.trim(),
                            channel: newChannel,
                            published: Date.now(),
                        },
                        channels: [session.value.actor],
                        allowed: [],
                    },
                    session.value,
                );

                // announce creator as first member
                await graffiti.post(
                    {
                        value: {
                            activity: "Join",
                            type: "Chat",
                            channel: newChannel,
                            published: Date.now(),
                        },
                        channels: [newChannel],
                    },
                    session.value,
                );

                newChatTitle.value = "";
            } finally {
                isCreatingChat.value = false;
            }
        }

        // Pending Invites
        // Invites are posted to the user's actor ID channel with allowed set
        // to only them, so only they can discover their own invites.
        const { objects: pendingInvites } = useGraffitiDiscover(
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
                            activity: { type: "string", const: "Invite" },
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

        // Invites user has already responded to
        const { objects: respondedInvites } = useGraffitiDiscover(
            () => (session.value ? [session.value.actor] : []),
            {
                properties: {
                    value: {
                        required: ["activity", "type", "channel", "published"],
                        properties: {
                            activity: {
                                type: "string",
                                const: "RespondedToInvite",
                            },
                            type: { type: "string", const: "Chat" },
                            channel: { type: "string" },
                            published: { type: "number" },
                        },
                    },
                },
            },
            session,
            true,
        );
        const respondedChannels = computed(
            () => new Set(respondedInvites.value.map((r) => r.value.channel)),
        );

        // filter out invites for chats the user has already joined
        const joinedChannels = computed(
            () => new Set(myChats.value.map((c) => c.value.channel)),
        );

        const filteredInvites = computed(() => {
            const seen = new Set();
            return pendingInvites.value
                .toSorted((a, b) => b.value.published - a.value.published)
                .filter((invite) => {
                    if (
                        joinedChannels.value.has(invite.value.channel) ||
                        respondedChannels.value.has(invite.value.channel) ||
                        seen.has(invite.value.channel)
                    ) {
                        return false;
                    }
                    seen.add(invite.value.channel);
                    return true;
                });
        });

        async function markInviteResponded(invite) {
            await graffiti.post(
                {
                    value: {
                        activity: "RespondedToInvite",
                        type: "Chat",
                        channel: invite.value.channel,
                        published: Date.now(),
                    },
                    channels: [session.value.actor],
                    allowed: [],
                },
                session.value,
            );
        }

        // Accept Invite
        // Accepting posts a Chat object to the user's own actor ID channel
        // so it shows up in their chat list
        async function acceptInvite(invite) {
            await graffiti.post(
                {
                    value: {
                        activity: "Create",
                        type: "Chat",
                        title: invite.value.title,
                        channel: invite.value.channel,
                        published: Date.now(),
                    },
                    channels: [session.value.actor],
                    allowed: [],
                },
                session.value,
            );
            await graffiti.post(
                {
                    value: {
                        activity: "Join",
                        type: "Chat",
                        channel: invite.value.channel,
                        published: Date.now(),
                    },
                    channels: [invite.value.channel],
                },
                session.value,
            );
            await markInviteResponded(invite);
        }

        async function declineInvite(invite) {
            await markInviteResponded(invite);
        }

        function openChat(chat) {
            router.push(`/chat/${chat.value.channel}`);
        }

        const isDeletingChat = ref(false);
        async function deleteChat(chat) {
            isDeletingChat.value = true;
            try {
                await graffiti.delete(chat, session.value);
            } finally {
                isDeletingChat.value = false;
            }
        }

        return {
            session,
            sortedChats,
            newChatTitle,
            isCreatingChat,
            createChat,
            openChat,
            isDeletingChat,
            deleteChat,
            filteredInvites,
            acceptInvite,
            declineInvite,
            markInviteResponded,
        };
    },
});
