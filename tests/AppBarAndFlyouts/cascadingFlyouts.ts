﻿// Copyright (c) Microsoft Open Technologies, Inc.  All Rights Reserved. Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
// <reference path="ms-appx://$(TargetFramework)/js/base.js" />
// <reference path="ms-appx://$(TargetFramework)/js/ui.js" />
// <reference path="ms-appx://$(TargetFramework)/js/en-us/ui.strings.js" />
// <reference path="ms-appx://$(TargetFramework)/css/ui-dark.css" />
// <reference path="../TestLib/Helper.ts"/>
// <reference path="OverlayHelpers.ts" />

module CorsicaTests {
    "use strict";

    var _rootAnchor: HTMLElement;
    var cascadeManager = WinJS.UI.Flyout['_cascadeManager'];
    var chainCounter;

    var DEFAULT_CHAIN_SIZE = 4; // default

    function hideFlyout(flyout?: WinJS.UI.Flyout): WinJS.Promise<any> {
        // Hides the specified flyout and all its subflyout in the cascade. 
        // If no flyout is specified we hide the entire cascade. 
        // Returns a promise that completes when all affected flyouts are finished hiding.

        var index = cascadeManager.indexOf(flyout);
        index = (index < 0) ? 0 : index;

        var flyoutChain: Array<WinJS.UI.Flyout> = cascadeManager._cascadingStack.slice(index, cascadeManager.length);

        var hidingPromises: Array<WinJS.Promise<any>> = flyoutChain.map(function (flyout: WinJS.UI.Flyout): WinJS.Promise<any> {
            return new WinJS.Promise(function (c, e, p) {
                function afterHide(): void {
                    flyout.removeEventListener("afterhide", afterHide, false);
                    c();
                };

                flyout.addEventListener("afterhide", afterHide, false);
            });//.then(function (): WinJS.Promise<any> { return WinJS.Promise.timeout(); });
        });

        flyoutChain[0].hide();
        return WinJS.Promise.join(hidingPromises);
    }

    function showFlyout(flyout: WinJS.UI.Flyout): WinJS.Promise<any> {
        // Show the specified flyout and returns a promise that is completed when the flyout has finished showing.
        return new WinJS.Promise(function (c, e, p): void {
            function afterShow(): void {
                flyout.removeEventListener("aftershow", afterShow, false);
                c();
            };
            flyout.addEventListener("aftershow", afterShow, false);
            flyout.show();
        });//.then(function (): WinJS.Promise<any> { return WinJS.Promise.timeout(0) });

        //return WinJS.Promise.join([
        //    new WinJS.Promise(function (c, e, p) {
        //        function afterShow() {
        //            flyout.removeEventListener("aftershow", afterShow, false);
        //            c();
        //        };
        //        flyout.addEventListener("aftershow", afterShow, false);
        //    }),
        //    new WinJS.Promise(function (c, e, p) {
        //        function afterFocus() {
        //            flyout.removeEventListener("focus", afterFocus, false);
        //            c();
        //        };
        //        flyout.addEventListener("focus", afterFocus, false);
        //    }),
        //    new WinJS.Promise(function (c, e, p) {
        //        flyout.show();
        //        c();
        //    }),
        //]);
    }

    function expandChain(flyoutChain: Array<WinJS.UI.Flyout>, sentinelFlyout?: WinJS.UI.Flyout): WinJS.Promise<any> {
        // Shows all flyouts in the specified flyoutChain until the sentinel flyout is shown.
        // If no sentinel is specified, the entire chain is shown.
        // Returns a promise that is completed when the last flyout is finished showing.

        var index: number = flyoutChain.indexOf(sentinelFlyout);
        flyoutChain = (index < 0) ? flyoutChain : flyoutChain.slice(0, index + 1);

        var p: WinJS.Promise<any> = WinJS.Promise.wrap();
        flyoutChain.forEach(function (flyout: WinJS.UI.Flyout, index: number): void {
            p = p.then(function (): WinJS.Promise<any> {
                return OverlayHelpers.show(flyoutChain[index]);
            });
        });

        return p;
    }

    var generateFlyoutChain = function generateFlyoutChain(numFlyouts?: number, anchor?: HTMLElement): Array<WinJS.UI.Flyout> {
        // Creates and return an Array of Flyouts. Each Flyout in the chain has its anchor property set to the HTMLElement of the previous flyout.
        var flyoutChain = [],
            chainClass = "chain_" + ++chainCounter,
            prevFlyout;

        // Default fallbacks.
        numFlyouts = numFlyouts || DEFAULT_CHAIN_SIZE;
        anchor = anchor || _rootAnchor;

        for (var i: number = 0; i < numFlyouts; i++) {
            anchor = prevFlyout ? prevFlyout.element : anchor;

            var flyout: WinJS.UI.Flyout = new WinJS.UI.Flyout(null, { anchor: anchor });
            document.body.appendChild(flyout.element);
            WinJS.Utilities.addClass(flyout.element, chainClass);
            flyout.element.id = (i + 1) + "of" + numFlyouts;

            flyoutChain.push(flyout);
            prevFlyout = flyout;
        }
        return flyoutChain;
    }

    export class CascadingFlyoutTests {

        setUp() {
            LiveUnit.LoggingCore.logComment("In setup");
            chainCounter = 0;

            _rootAnchor = document.createElement('button');
            _rootAnchor.id = "rootanchor";
            document.body.appendChild(_rootAnchor);
        }

        tearDown() {
            LiveUnit.LoggingCore.logComment("In tearDown");
            chainCounter = 0;
            cascadeManager.empty();

            var flyouts: NodeList = document.querySelectorAll(".win-flyout");
            Array.prototype.forEach.call(flyouts, function (element: HTMLElement): void {
                OverlayHelpers.disposeAndRemove(element);
                element = null;
            });

            OverlayHelpers.disposeAndRemove(_rootAnchor);
            OverlayHelpers.disposeAndRemove(document.querySelector("." + WinJS.UI._Overlay._clickEatingAppBarClass));
            OverlayHelpers.disposeAndRemove(document.querySelector("." + WinJS.UI._Overlay._clickEatingFlyoutClass));
            WinJS.UI._Overlay._clickEatingAppBarDiv = false;
            WinJS.UI._Overlay._clickEatingFlyoutDiv = false;
        }

        testSingleFlyoutInTheCascade = function (complete): void {
            // Verifies that showing and hiding a flyout will always add and remove it from the cascade.

            function checkAfterShow(): void {
                flyout.removeEventListener("aftershow", checkAfterShow, false);

                var msg: string = "Showing a flyout should always add it to the cascade";
                LiveUnit.LoggingCore.logComment("Test: " + msg);

                LiveUnit.Assert.isTrue(cascadeManager.indexOf(flyout) >= 0, msg);
                LiveUnit.Assert.areEqual(cascadeManager.length, 1);

                flyout.hide();
            };
            function checkAfterHide(): void {
                flyout.removeEventListener("afterhide", checkAfterHide, false);

                var msg: string = "Hiding a flyout should always remove it from the cascade";
                LiveUnit.LoggingCore.logComment("Test: " + msg);

                LiveUnit.Assert.isFalse(cascadeManager.indexOf(flyout) >= 0, msg);
                LiveUnit.Assert.areEqual(cascadeManager.length, 0);

                complete();
            };

            var flyoutElement: HTMLElement = document.createElement("div");
            document.body.appendChild(flyoutElement);
            var flyout: WinJS.UI.Flyout = new WinJS.UI.Flyout(flyoutElement, { anchor: _rootAnchor });

            var msg: string = "The cascade should be empty when no flyouts are showing";
            LiveUnit.LoggingCore.logComment("Test: " + msg);
            LiveUnit.Assert.areEqual(cascadeManager.length, 0, msg);

            flyout.addEventListener("aftershow", checkAfterShow, false);
            flyout.addEventListener("afterhide", checkAfterHide, false);

            flyout.show();
        }

        testChainedFlyoutsWillAppendToTheCascadeWhenShownInOrder = function (complete): void {
            // Verifies that showing chained flyouts, one after the other, in order, will cause them all show in the cascade.

            var flyoutChain: Array<WinJS.UI.Flyout> = generateFlyoutChain();

            expandChain(flyoutChain).then(function (): void {
                var msg = "Each chained flyout that was shown should have been appended to the cascade in order";
                LiveUnit.LoggingCore.logComment("Test: " + msg);
                LiveUnit.Assert.areEqual(flyoutChain.length, cascadeManager.length, msg);
                for (var i: number = 0, len: number = flyoutChain.length; i < len; i++) {
                    LiveUnit.Assert.areEqual(flyoutChain[i], cascadeManager.getAt(i), msg);
                }

                msg = "There should be " + flyoutChain.length + " flyouts visible after cascading the entire flyout chain.";
                LiveUnit.LoggingCore.logComment("Test: " + msg);
                var cascadingFlyouts: Array<HTMLElement> = Array.prototype.filter.call(document.querySelectorAll(".win-flyout"), function (flyoutElement: HTMLElement): boolean {
                    return !flyoutElement.winControl.hidden;
                });
                LiveUnit.Assert.areEqual(flyoutChain.length, cascadingFlyouts.length, msg);
                complete();
            });
        }

        testShowingASiblingSubFlyoutClosesOtherSubFlyoutChain = function (complete) {
            // Verifies that, showing a flyout "A" whose anchor is an element contained within a flyout "B", while "B" is already showing in the cascade will:
            // 1) Removes all subflyouts after "B" from the cascasde, making "B" the new end.
            // 2) Appends "A" to the end of the cascade after "B".

            var flyoutChain: Array<WinJS.UI.Flyout> = generateFlyoutChain(),
                requiredSize: number = 2;
            LiveUnit.Assert.isTrue(flyoutChain.length >= requiredSize, "ERROR: Test requires input size of at least " + requiredSize);

            expandChain(flyoutChain).then(function (): void {

                var anchor: HTMLElement = flyoutChain[requiredSize - 1].element,
                    otherFlyout: WinJS.UI.Flyout = generateFlyoutChain(1, anchor)[0]; // Create a single Flyout 

                OverlayHelpers.show(otherFlyout).then(function (): void {
                    var msg: string = "Showing a flyout (A), that is chained to a flyout already in the cascade (B), should replace all subflyouts in the cascade following flyout (B) with flyout (A)";
                    LiveUnit.LoggingCore.logComment("Test: " + msg);

                    var expectedCascade: Array<WinJS.UI.Flyout> = flyoutChain.slice(0, requiredSize).concat(otherFlyout);
                    LiveUnit.Assert.areEqual(expectedCascade.length, cascadeManager.length, msg);
                    for (var i: number = 0, len: number = expectedCascade.length; i < len; i++) {
                        LiveUnit.Assert.areEqual(expectedCascade[i], cascadeManager.getAt(i), msg);
                    }

                    var visibleFlyouts: Array<HTMLElement> = Array.prototype.filter.call(document.querySelectorAll(".win-flyout"), function (flyoutElement: HTMLElement) {
                        return !flyoutElement.winControl.hidden;
                    });
                    expectedCascade.forEach(function (flyout: WinJS.UI.Flyout, index: number): void {
                        LiveUnit.Assert.areEqual(flyout.element, visibleFlyouts[index], msg);
                    });

                    msg = "There should be " + expectedCascade.length + " flyouts visible.";
                    LiveUnit.LoggingCore.logComment("Test: " + msg);
                    LiveUnit.Assert.areEqual(expectedCascade.length, visibleFlyouts.length, msg);
                    complete();
                });
            });
        }

        xtestFocusIsManagedInTheCascade = function (complete) {
            // Verify that focus is always put in the tail flyout of the cascade whenever we hide or show flyouts.

            // Assert that the test expects at least 4 flyouts to be generated.

            // showPromise all 4 flyouts checking focus after each promise. 
            // hidePromise the last flyout, checking focus after the promise.
            // hidePromise the flyout @ index 1, verify only remaining flyout in the cascade has focus.

        }
    }
}

// register the object as a test class by passing in the name
LiveUnit.registerTestClass("CorsicaTests.CascadingFlyoutTests");