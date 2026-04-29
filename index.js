import { createApp, defineAsyncComponent } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

function loadComponent(name) {
    return () => import(`./${name}/main.js`).then((m) => m.default());
}

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/", component: loadComponent("home") },
        {
            path: "/chat/:chatId",
            component: loadComponent("chat"),
            props: true,
            children: [
                {
                    path: "",
                    redirect: (to) => `/chat/${to.params.chatId}/chat-tab`,
                },
                {
                    path: "chat-tab",
                    component: loadComponent("chat/tabs/chat"),
                },
                { path: "board", component: loadComponent("chat/tabs/board") },
                { path: "tasks", component: loadComponent("chat/tabs/tasks") },
            ],
        },
    ],
});

createApp({ template: "#template" })
    .use(router)
    .use(GraffitiPlugin, { graffiti: new GraffitiDecentralized() })
    .mount("#app");
