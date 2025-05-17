import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  bool _isSigningIn = false;
  String? _error;

  Future<void> _signInWithGoogle() async {
    setState(() {
      _isSigningIn = true;
      _error = null;
    });
    try {
      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        setState(() {
          _isSigningIn = false;
          _error = 'Sign in aborted.';
        });
        return;
      }
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      await FirebaseAuth.instance.signInWithCredential(credential);
      setState(() {
        _isSigningIn = false;
      });
    } catch (e) {
      setState(() {
        _isSigningIn = false;
        _error = 'Sign in failed: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login to VocalQ')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_error != null) ...[
              Text(_error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 16),
            ],
            ElevatedButton.icon(
              icon: Image.asset('assets/google_logo.png', height: 24),
              label: Text(_isSigningIn ? 'Signing in...' : 'Sign in with Google'),
              onPressed: _isSigningIn ? null : _signInWithGoogle,
            ),
          ],
        ),
      ),
    );
  }
} 