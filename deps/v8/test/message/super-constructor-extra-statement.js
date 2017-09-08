// Copyright 2014 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


'use strict';

class C {
  constructor() {
    var x;
    super(x);
  }
}

var c = new C();
