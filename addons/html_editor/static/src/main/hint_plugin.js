import { Plugin } from "@html_editor/plugin";
import { isEmptyBlock, isProtected } from "@html_editor/utils/dom_info";
import { removeClass } from "@html_editor/utils/dom";
import { selectElements } from "@html_editor/utils/dom_traversal";
import { closestBlock } from "../utils/blocks";

function isMutationRecordSavable(record) {
    return !(record.type === "attributes" && record.attributeName === "placeholder");
}

/**
 * @param {SelectionData} selectionData
 * @param {HTMLElement} editable
 */
function target(selectionData, editable) {
    const el = editable.firstChild;
    if (
        !selectionData.documentSelectionIsInEditable &&
        el &&
        el.tagName === "P" &&
        editable.textContent === ""
    ) {
        return el;
    }
}

export class HintPlugin extends Plugin {
    static name = "hint";
    static dependencies = ["history", "selection"];
    /** @type { (p: HintPlugin) => Record<string, any> } */
    static resources = (p) => {
        const resources = {
            mutation_filtered_classes: ["o-we-hint"],
            is_mutation_record_savable: isMutationRecordSavable,
            onSelectionChange: p.updateHints.bind(p),
            onExternalHistorySteps: () => {
                p.clearHints();
                p.updateHints();
            },
        };
        if (p.config.placeholder) {
            resources.hints = {
                text: p.config.placeholder,
                target,
            };
        }

        return resources;
    };

    setup() {
        this.hint = null;
        this.updateHints(this.editable);
    }

    destroy() {
        super.destroy();
        this.clearHints();
    }

    handleCommand(command, payload) {
        switch (command) {
            case "CONTENT_UPDATED": {
                this.updateHints(payload.root);
                break;
            }
            case "CLEAN":
            case "CLEAN_FOR_SAVE":
                this.clearHints(payload.root);
                break;
        }
    }

    /**
     * @param {HTMLElement} [root]
     */
    updateHints() {
        const selectionData = this.shared.getSelectionData();
        const editableSelection = selectionData.editableSelection;
        if (this.hint) {
            const blockEl = closestBlock(editableSelection.anchorNode);
            this.removeHint(this.hint);
            this.removeHint(blockEl);
        }
        if (editableSelection.isCollapsed) {
            for (const hint of this.resources["hints"]) {
                if (hint.selector) {
                    const el = closestBlock(editableSelection.anchorNode);
                    if (el && el.matches(hint.selector) && !isProtected(el) && isEmptyBlock(el)) {
                        this.makeHint(el, hint.text);
                        this.hint = el;
                    }
                } else {
                    const target = hint.target(selectionData, this.editable);
                    // Do not replace an existing empty block hint by a temp hint.
                    if (target && !target.classList.contains("o-we-hint")) {
                        this.makeHint(target, hint.text);
                        this.hint = target;
                        return;
                    }
                }
            }
        }
    }

    makeHint(el, text) {
        el.setAttribute("placeholder", text);
        el.classList.add("o-we-hint");
    }

    removeHint(el) {
        el.removeAttribute("placeholder");
        removeClass(el, "o-we-hint");
        if (this.hint === el) {
            this.hint = null;
        }
    }

    clearHints(root = this.editable) {
        for (const elem of selectElements(root, ".o-we-hint")) {
            this.removeHint(elem);
        }
    }
}
