package org.mieweb.systembars;

import android.graphics.Color;
import android.view.View;

import androidx.core.graphics.ColorUtils;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;

// Android 15+ forces edge-to-edge; pad the WebView's container and zero the insets it sees.
// https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets
public class SystemBars extends CordovaPlugin {
    private static final int BAR_TYPES =
            WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();

    private View container;

    @Override
    protected void pluginInitialize() {
        container = (View) webView.getView().getParent();
        ViewCompat.setOnApplyWindowInsetsListener(container, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(BAR_TYPES);
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return new WindowInsetsCompat.Builder(windowInsets)
                    .setInsets(BAR_TYPES, Insets.NONE)
                    .build();
        });
        ViewCompat.requestApplyInsets(container);
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext)
            throws JSONException {
        if (!"setColor".equals(action)) {
            return false;
        }
        int color = Color.rgb(args.getInt(0), args.getInt(1), args.getInt(2));
        boolean lightBackground = ColorUtils.calculateLuminance(color) > 0.5;

        cordova.getActivity().runOnUiThread(() -> {
            container.setBackgroundColor(color);
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(cordova.getActivity().getWindow(), container);
            controller.setAppearanceLightStatusBars(lightBackground);
            controller.setAppearanceLightNavigationBars(lightBackground);
            callbackContext.success();
        });
        return true;
    }
}
