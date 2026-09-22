/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 philosolog
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { StarFilled } from "@components/Icons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Message, Sticker } from "@vencord/discord-types";
import { Menu, showToast, StickersStore, Toasts, UserSettingsActionCreators } from "@webpack/common";

const StickerExt = [, "png", "png", "json", "gif"] as const;

type PartialSticker = Pick<Sticker, "id" | "format_type">;

function getUrl(data: PartialSticker): string {
    if (data.format_type === 4)
        return `https:${window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT}/stickers/${data.id}.gif?size=320&lossless=true`;

    return `https://${window.GLOBAL_ENV.CDN_HOST}/stickers/${data.id}.${StickerExt[data.format_type]}?size=320&lossless=true`;
}

function addStickerToFavoriteGifs(sticker: PartialSticker) {
    const url = getUrl(sticker);

    let alreadyFavorited = false;

    UserSettingsActionCreators.FrecencyUserSettingsActionCreators.updateAsync("favoriteGifs", (favoriteGifs: any) => {
        favoriteGifs.gifs ??= {};

        if (favoriteGifs.gifs[url]) {
            alreadyFavorited = true;
            return;
        }

        const order = 1 + Math.max(0, ...Object.values(favoriteGifs.gifs).map((gif: any) => gif.order ?? 0));

        favoriteGifs.gifs[url] = {
            format: 1,
            src: url,
            url,
            width: 320,
            height: 320,
            order
        };
    });

    showToast(alreadyFavorited ? "Sticker is already a Favorite GIF" : "Added sticker to Favorite GIFs", Toasts.Type.SUCCESS);
}

function buildMenuItem(sticker: PartialSticker) {
    return (
        <Menu.MenuItem
            id="vc-favorite-sticker-as-gif"
            key="vc-favorite-sticker-as-gif"
            label="Add to Favorite GIFs"
            leadingAccessory={<StarFilled />}
            action={() => addStickerToFavoriteGifs(sticker)}
        />
    );
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (
    children,
    { favoriteableId, favoriteableType, message }: { favoriteableId: string; favoriteableType: string; message: Message; }
) => {
    if (!favoriteableId || favoriteableType !== "sticker") return;

    const sticker = message.stickerItems.find(s => s.id === favoriteableId);
    if (!sticker?.format_type || sticker.format_type === 3 /* LOTTIE */) return;

    children.splice(-1, 0, buildMenuItem(sticker));
};

const expressionPickerPatch: NavContextMenuPatchCallback = (children, props: { target: HTMLElement; }) => {
    const id = props?.target?.dataset?.id;
    if (!id) return;
    if (props.target.className?.includes("lottieCanvas")) return;

    const sticker = StickersStore.getStickerById(id);
    if (sticker && sticker.format_type !== 3 /* LOTTIE */) {
        children.push(buildMenuItem(sticker));
    }
};

export default definePlugin({
    name: "StickersAsGifs",
    description: "Adds stickers to your Favorite GIFs, so you can send them like GIFs even without Nitro or send permissions",
    tags: ["Emotes", "Media", "Utility"],
    authors: [Devs.philosolog],
    contextMenus: {
        "message": messageContextMenuPatch,
        "expression-picker": expressionPickerPatch
    }
});
