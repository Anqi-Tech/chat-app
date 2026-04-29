export default async () => ({
    props: ["msg"],
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
    ),
    setup(props) {
        return {};
    },
});
