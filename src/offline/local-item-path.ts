/** Root-relative identity is distinct from a native catalog's display basename. */
export function localItemRelativePath(item: any): string | null {
    if (!item || typeof item !== "object") return null;
    // An explicitly supplied but invalid path must never become a different
    // item by falling back to its display name. Older catalogs omit the field.
    var value = Object.prototype.hasOwnProperty.call(item, "relativePath")
        ? item.relativePath
        : item.name;
    if (
        typeof value !== "string" ||
        !value ||
        value.trim() !== value ||
        value.length > 8192 ||
        /^[\/]|\\|^[A-Za-z]:|[\u0000-\u001f\u007f]/.test(value) ||
        // Empty segments also reject URL schemes containing ://.
        /(^|\/)\.{0,2}(\/|$)/.test(value)
    )
        return null;
    if (
        /[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/.test(
            value
        )
    )
        return null;
    return value;
}
