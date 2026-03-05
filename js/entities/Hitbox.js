export default class Hitbox {
    /**
     * @param {number} offsetX - X dist from Fighter center
     * @param {number} offsetY - Y dist from Fighter origin (usually bottom/feet)
     * @param {number} width 
     * @param {number} height 
     */
    constructor(offsetX, offsetY, width, height) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.width = width;
        this.height = height;
    }

    /**
     * Calculate absolute world coordinates based on parent
     * @param {number} px - Parent X (center)
     * @param {number} py - Parent Y (bottom/feet)
     * @param {number} facing - 1 for Right, -1 for Left
     */
    getWorldRect(px, py, facing) {
        // If facing left (-1), flip the offsetX relative to center
        const actualOffsetX = facing === 1 ? this.offsetX : -(this.offsetX + this.width);

        return {
            x: px + actualOffsetX,
            y: py - this.offsetY - this.height, // Draw up from floor
            width: this.width,
            height: this.height
        };
    }

    static checkCollision(rectA, rectB) {
        return (
            rectA.x < rectB.x + rectB.width &&
            rectA.x + rectA.width > rectB.x &&
            rectA.y < rectB.y + rectB.height &&
            rectA.y + rectA.height > rectB.y
        );
    }
}
