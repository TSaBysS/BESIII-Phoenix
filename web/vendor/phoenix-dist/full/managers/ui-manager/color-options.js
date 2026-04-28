import { PrettySymbols } from '../../helpers/pretty-symbols';
/** Keys for options available for coloring event data by. */
export var ColorByOptionKeys;
(function (ColorByOptionKeys) {
    ColorByOptionKeys["CHARGE"] = "charge";
    ColorByOptionKeys["MOM"] = "mom";
    ColorByOptionKeys["VERTEX"] = "vertex";
})(ColorByOptionKeys || (ColorByOptionKeys = {}));
/**
 * Color options with functions to color event data.
 */
export class ColorOptions {
    /**
     * Create the color options.
     * @param colorManager Color manager for three.js functions related to coloring of objects.
     * @param collectionFolder Collection folder to add the color by options to.
     * @param colorByOptionsToInclude Options to include for this collection to color event data by.
     */
    constructor(colorManager, collectionFolder, collectionColor, colorByOptionsToInclude) {
        this.colorManager = colorManager;
        /** All color by options possible. */
        this.allColorByOptions = [
            {
                key: ColorByOptionKeys.CHARGE,
                name: 'Charge ' + PrettySymbols.getPrettySymbol('charge'),
                initialize: this.initChargeColorOptions.bind(this),
                apply: this.applyChargeColorOptions.bind(this),
            },
            {
                key: ColorByOptionKeys.MOM,
                name: 'Momentum ' + PrettySymbols.getPrettySymbol('mom'),
                initialize: this.initMomColorOptions.bind(this),
                apply: this.applyMomColorOptions.bind(this),
            },
            {
                key: ColorByOptionKeys.VERTEX,
                name: 'Vertex',
                apply: this.applyVertexColorOptions.bind(this),
            },
        ];
        // Charge options.
        /** Default values for colors for color by charge. */
        this.chargeColors = {
            '-1': '#ff0000',
            '0': '#ff0000',
            '1': '#ff0000',
        };
        // Momentum options.
        /** Default values for colors and min/max for color by momentum. */
        this.momColors = {
            min: {
                value: 0,
                color: '#ff0000',
            },
            max: {
                value: 50000,
                color: '#ff0000',
            },
        };
        this.collectionName = collectionFolder.name;
        this.colorOptionsFolder = collectionFolder.addChild('Color Options');
        this.colorOptionsFolder.addConfig({
            type: 'color',
            label: 'Color',
            color: collectionColor
                ? `#${collectionColor?.getHexString()}`
                : undefined,
            onChange: (value) => this.colorManager.collectionColor(this.collectionName, value),
        });
        this.colorOptionsFolder.addConfig({
            type: 'button',
            label: 'Random',
            onClick: () => this.colorManager.collectionColorRandom(this.collectionName),
        });
        // Check which color by options are to be included.
        if (colorByOptionsToInclude?.length &&
            colorByOptionsToInclude?.length > 0) {
            this.colorByOptions = this.allColorByOptions.filter((colorByOption) => colorByOptionsToInclude.includes(colorByOption.key));
            this.initColorByOptions();
            this.colorByOptions.forEach((colorByOption) => colorByOption.initialize?.());
            this.onlySelectedColorByOption();
        }
    }
    /**
     * Initialize the color options.
     */
    initColorByOptions() {
        this.selectedColorByOption = this.colorByOptions[0].key;
        // Configurations
        this.colorOptionsFolder.addConfig({
            type: 'select',
            label: 'Color by',
            options: this.colorByOptions.map((colorByOption) => colorByOption.name),
            onChange: (updatedColorByOption) => {
                const newColorByOption = this.colorByOptions.find((colorByOption) => colorByOption.name === updatedColorByOption);
                if (newColorByOption?.key)
                    this.selectedColorByOption = newColorByOption.key;
                newColorByOption?.apply?.();
                this.onlySelectedColorByOption();
            },
        });
    }
    // Charge options.
    /**
     * Initialize charge color options.
     */
    initChargeColorOptions() {
        // Charge configurations
        [-1, 0, 1].forEach((chargeValue) => {
            const chargeValueIndex = chargeValue.toString();
            this.colorOptionsFolder.addConfig({
                type: 'color',
                label: `${PrettySymbols.getPrettySymbol('charge')}=${chargeValue}`,
                group: ColorByOptionKeys.CHARGE,
                color: this.chargeColors[chargeValueIndex],
                onChange: (color) => {
                    this.chargeColors[chargeValueIndex] = color;
                    if (this.selectedColorByOption === ColorByOptionKeys.CHARGE) {
                        this.colorManager.colorObjectsByProperty(color, this.collectionName, (objectUserData) => this.shouldColorByCharge(objectUserData, chargeValue));
                    }
                },
            });
        });
    }
    /**
     * Apply charge color options.
     */
    applyChargeColorOptions() {
        [-1, 0, 1].forEach((chargeValue) => {
            this.colorManager.colorObjectsByProperty(this.chargeColors[chargeValue.toString()], this.collectionName, (objectUserData) => this.shouldColorByCharge(objectUserData, chargeValue));
        });
    }
    /**
     * Check if object should be colored based on charge value.
     * @param objectParams Object parameters associated to the 3D object.
     * @param chargeValue Value of charge (-1, 0, 1).
     * @returns Whether the charge is equal to the value.
     */
    shouldColorByCharge(objectParams, chargeValue) {
        // For ATLAS data, the charge is calculated from dparams[4] otherwise it exists as an object's userData
        if (Math.sign(1 / parseInt(objectParams?.dparams?.[4])) === chargeValue) {
            return true;
        }
        else if (objectParams?.charge === chargeValue) {
            return true;
        }
        return false;
    }
    // Momentum options.
    /**
     * Initialize momentum color options.
     */
    initMomColorOptions() {
        // Momentum configurations
        Object.entries(this.momColors).forEach(([key, momValue]) => {
            this.colorOptionsFolder.addConfig({
                type: 'slider',
                label: PrettySymbols.getPrettySymbol('mom') + ' ' + key,
                group: ColorByOptionKeys.MOM,
                min: this.momColors.min.value,
                max: this.momColors.max.value,
                value: this.momColors[key].value,
                step: 10,
                allowCustomValue: true,
                onChange: (sliderValue) => {
                    this.momColors[key].value = sliderValue;
                    if (this.selectedColorByOption === ColorByOptionKeys.MOM) {
                        this.colorByMomentum('min');
                        this.colorByMomentum('max');
                    }
                },
            });
            this.colorOptionsFolder.addConfig({
                type: 'color',
                label: PrettySymbols.getPrettySymbol('mom') + ' ' + key + ' color',
                group: ColorByOptionKeys.MOM,
                color: momValue.color,
                onChange: (color) => {
                    this.momColors[key].color = color;
                    if (this.selectedColorByOption === ColorByOptionKeys.MOM) {
                        this.colorByMomentum(key);
                    }
                },
            });
        });
    }
    /**
     * Apply momentum color options.
     */
    applyMomColorOptions() {
        this.colorByMomentum('min');
        this.colorByMomentum('max');
    }
    /**
     * Color event data based on the momentum property of each object.
     * @param minOrMax If the momentum to color objects by is minimum or maximum momentum.
     * This is to apply the stored momentum colors for minimum and maximum separated at the mid value.
     */
    colorByMomentum(minOrMax) {
        this.colorManager.colorObjectsByProperty(this.momColors[minOrMax].color, this.collectionName, (objectParams) => {
            const mom = this.getMomentum(objectParams);
            const mid = (this.momColors.min.value + this.momColors.max.value) / 2;
            if (minOrMax === 'max' && mom > mid && mom < this.momColors.max.value) {
                return true;
            }
            else if (minOrMax === 'min' &&
                mom < mid &&
                mom > this.momColors.min.value) {
                return true;
            }
            return false;
        });
    }
    /**
     * Get momentum from object parameters.
     * @param objectParams Parameters associated to the 3D object.
     * @returns THe momentum value.
     */
    getMomentum(objectParams) {
        return objectParams?.dparams?.[4]
            ? Math.abs(1 / parseFloat(objectParams?.dparams?.[4]))
            : objectParams?.mom;
    }
    // Vertex options.
    /**
     * Apply color by vertex to tracks.
     */
    applyVertexColorOptions() {
        this.colorManager.colorTracksByVertex(this.collectionName);
    }
    /**
     * Show configs of only the currently selected color by option.
     */
    onlySelectedColorByOption() {
        this.colorOptionsFolder.configs.forEach((config) => {
            const groupNotSelected = config.group !== undefined &&
                config.group !== this.selectedColorByOption;
            config.hidden = groupNotSelected;
        });
    }
}
//# sourceMappingURL=color-options.js.map