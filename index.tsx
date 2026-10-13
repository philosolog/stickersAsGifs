/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 philosolog
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "@plugins/stickersAsGifs/style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { StarFilled } from "@components/Icons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Message, Sticker } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { Menu, React, showToast, StickersStore, UserSettingsActionCreators } from "@webpack/common";

const GifFavoriteButton = findComponentByCodeLazy(".FAVORITE_GIF", "ignoreKeyPress:!0");

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

    showToast(alreadyFavorited ? "Sticker is already a Favorite GIF" : "Added sticker to Favorite GIFs", "success");
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
    patches: [
        {
            find: "}renderStickersAccessories(",
            replacement: {
                match: /(\.map\((\i)=>)(\(0,\i\.jsx\)\(\i,\{channel:\i,isInteracting:\i,renderableSticker:\2\},\2\.id\))/,
                replace: "$1$self.wrapSticker($2,$3)"
            }
        },
        {
            find: "stickerDescriptors:",
            replacement: {
                match: /(\.createElement\)\("div",\{\.\.\.\i,key:(\i)\.sticker\.id)(\},)/,
                replace: '$1,className:"vc-stickers-as-gifs"$3$self.renderFavoriteButton($2.sticker),'
            }
        }
    ],
    renderFavoriteButton(sticker: PartialSticker) {
        if (!sticker.format_type || sticker.format_type === 3 /* LOTTIE */) return null;

        const url = getUrl(sticker);
        return (
            <ErrorBoundary noop>
                <GifFavoriteButton
                    className="vc-stickers-as-gifs-star"
                    url={url}
                    src={url}
                    format={1}
                    width={320}
                    height={320}
                />
            </ErrorBoundary>
        );
    },
    wrapSticker(sticker: PartialSticker, children: React.ReactNode) {
        return (
            <div className="vc-stickers-as-gifs vc-stickers-as-gifs-message" key={sticker.id}>
                {children}
                {this.renderFavoriteButton(sticker)}
            </div>
        );
    },
    contextMenus: {
        "message": messageContextMenuPatch,
        "expression-picker": expressionPickerPatch
    }
});
