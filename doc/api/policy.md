# Policies

<!--introduced_in=TODO-->
<!-- type=misc -->

> Stability: 0 - Experimental

<!-- name=policy -->

Node.js contains experimental support for creating policies on loading code.

## Enabling

<!-- type=misc -->

The `--experimental-policy` flag can be used to enable features for policies when loading modules.

Once this has been set, all modules must conform to a policy file passed to the flag

```sh
node --experimental-policy policy.json app.js
```

## Features

### Integrity Checks

Policy files must use integrity checks with Subresource Integrity strings compatible with the [integrity attribute as present in browsers](https://www.w3.org/TR/SRI/#the-integrity-attribute) associated with absolute URLs.

And example policy file that would let you load a file `checked.js` would be:

```json
{
  "resources": {
    "file:///path/to/checked.js": {
      "integrity": "sha384-SggXRQHwCG8g+DktYYzxkXRIkTiEYWBHqev0xnpCxYlqMBufKZHAHQM3/boDaI/0"
    }
  }
}
```

In order to generate integrity strings, a script such as `printf "sha384-$(cat checked.js | openssl dgst -sha384 -binary | base64)"` can be used.

### Whitelisting Dependencies

Whenever resources need to access dependencies, a policy can be used to prevent loading reasources that are not authorized. In order to aggregate policies that have similar privileges they must be provided in a dictionary within the policy file mapping the name of the policy to the actual authorizations it grants.

These policy names can then be associated with resources.

By default no package dependencies can be accessed if not listed in a policy.

TODO: add boundary check to only allow loading relative paths within a package and a privilege required to load paths outside of a package.

```mjs
{
  "policies": {
    "from_tool": {
      "privileges": {
        "dependencies": {
          "fs": true
        }
      }
    },
  },
  "resources": {
    "file:///path/to/checked.js": {
      "integrity": "sha384-SggXRQHwCG8g+DktYYzxkXRIkTiEYWBHqev0xnpCxYlqMBufKZHAHQM3/boDaI/0",
      "policy": "from_tool"
    }
  }
}
```
