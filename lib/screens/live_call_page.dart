import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';

class LiveCallPage extends StatefulWidget {
  const LiveCallPage({super.key});

  @override
  State<LiveCallPage> createState() => _LiveCallPageState();
}

class _LiveCallPageState extends State<LiveCallPage> {
  final TextEditingController _transcriptController = TextEditingController();
  String _analysis = '';
  bool _isAnalyzing = false;

  Future<void> _analyzeTranscript() async {
    if (_transcriptController.text.isEmpty) return;

    setState(() {
      _isAnalyzing = true;
      _analysis = 'Analyzing...';
    });

    try {
      final functions = FirebaseFunctions.instance;
      final callable = functions.httpsCallable('analyzeTranscript');
      
      final result = await callable.call({
        'transcript': _transcriptController.text,
      });

      setState(() {
        _analysis = result.data['analysis'] ?? 'No analysis available';
        _isAnalyzing = false;
      });
    } catch (e) {
      setState(() {
        _analysis = 'Error analyzing transcript: $e';
        _isAnalyzing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('VocalQ Live Call Analysis'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _transcriptController,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Call Transcript',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isAnalyzing ? null : _analyzeTranscript,
              child: Text(_isAnalyzing ? 'Analyzing...' : 'Analyze Transcript'),
            ),
            const SizedBox(height: 16),
            const Text(
              'Analysis Results:',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SingleChildScrollView(
                  child: Text(_analysis),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _transcriptController.dispose();
    super.dispose();
  }
} 