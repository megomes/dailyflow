package app.dailyflow.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import androidx.wear.tiles.TileService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val Bg = Color(0xFF141416)
private val Text1 = Color(0xFFF3F3F4)
private val Text2 = Color(0xFFA1A1A6)
private val Muted = Color(0xFF717176)

/** Full watch app (spec §83): current block, next, today's timeline, next tasks, start/stop. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val api = Api(this)
        setContent {
            MaterialTheme {
                var paired by remember { mutableStateOf(api.creds.paired) }
                // adb shell am start -n app.dailyflow/.wear.MainActivity --es pair_code ABCD2345 (pairs without typing)
                val autoCode = intent.getStringExtra("pair_code")
                LaunchedEffect(autoCode) { if (autoCode != null && !paired) api.pair(api.creds.host, autoCode).onSuccess { paired = true; app.dailyflow.wear.face.FaceData.refresh(applicationContext) } }
                if (paired) NowScreen(api) { api.creds.clear(); paired = false }
                else PairScreen(api) { paired = true }
            }
        }
    }
}

@Composable
private fun NowScreen(api: Api, onUnpair: () -> Unit) {
    val scope = rememberCoroutineScope()
    var snap by remember { mutableStateOf<Snapshot?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    val context = androidx.compose.ui.platform.LocalContext.current
    suspend fun refresh() {
        snap = api.snapshot()
        TileService.getUpdater(context).requestUpdate(NowTileService::class.java)
    }
    LaunchedEffect(Unit) { while (true) { refresh(); delay(60_000) } }
    val listState = rememberScalingLazyListState()
    Scaffold(timeText = { TimeText() }, positionIndicator = { PositionIndicator(scalingLazyListState = listState) }) {
        ScalingLazyColumn(state = listState, modifier = Modifier.fillMaxSize().background(Bg), horizontalAlignment = Alignment.CenterHorizontally) {
            val s = snap
            item { Label(if (s?.runningTitle != null) "DOING" else "NOW") }
            item {
                Text(
                    text = s?.runningTitle ?: s?.now?.title ?: if (s == null) "…" else "Nothing planned",
                    color = Text1, fontSize = 20.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis,
                )
            }
            item {
                val line = when {
                    s?.focusTitle != null && s.focusLeftSec != null -> "Focus · ${maxOf(0, s.focusLeftSec / 60)} min left"
                    s?.runningSince != null -> "since ${s.runningSince}"
                    s?.now != null -> "until ${s.now.endLabel} · ${s.remainingMin} min"
                    else -> ""
                }
                Text(line, color = Text2, fontSize = 13.sp)
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    CompactChip(onClick = { scope.launch { message = api.quick("start"); refresh() } }, label = { Text("Start") }, colors = ChipDefaults.primaryChipColors())
                    CompactChip(onClick = { scope.launch { message = api.quick("stop"); refresh() } }, label = { Text("Stop") }, colors = ChipDefaults.secondaryChipColors())
                }
            }
            message?.let { m -> item { Text(m, color = Muted, fontSize = 11.sp) } }
            s?.next?.let { n -> item { Label("NEXT") }; item { Text("${n.title} · ${n.startLabel}", color = Text1, fontSize = 14.sp, textAlign = TextAlign.Center) } }
            if (s != null && s.nextTasks.isNotEmpty()) {
                item { Label("TASKS") }
                s.nextTasks.forEach { t -> item { Text("○ $t", color = Text2, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) } }
            }
            if (s != null) {
                item { Label("TODAY") }
                s.timeline.filter { it.end > s.minute - 60 }.forEach { b ->
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth(0.85f)) {
                            Text(b.startLabel, color = Muted, fontSize = 12.sp)
                            Box(Modifier.size(width = 4.dp, height = 14.dp).background(Color(b.color), RoundedCornerShape(2.dp)))
                            Text(b.title, color = if (b.start <= s.minute && s.minute < b.end) Text1 else Text2, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
            item { CompactChip(onClick = onUnpair, label = { Text("Unpair") }, colors = ChipDefaults.childChipColors()) }
        }
    }
}

@Composable
private fun PairScreen(api: Api, onPaired: () -> Unit) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(Bg).padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("Pair DailyFlow", color = Text1, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Text("Web › Settings › Device", color = Muted, fontSize = 11.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        BasicTextField(
            value = code, onValueChange = { code = it.uppercase().filter { c -> c.isLetterOrDigit() }.take(8) },
            singleLine = true, textStyle = TextStyle(color = Text1, fontSize = 18.sp, textAlign = TextAlign.Center, letterSpacing = 2.sp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
            modifier = Modifier.fillMaxWidth().background(Color(0xFF29292B), RoundedCornerShape(10.dp)).padding(8.dp),
            decorationBox = { inner -> if (code.isEmpty()) Text("CODE", color = Muted, fontSize = 18.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) else inner() },
        )
        Spacer(Modifier.height(8.dp))
        CompactChip(
            enabled = code.length == 8 && !busy,
            onClick = { busy = true; scope.launch { api.pair(api.creds.host, code).onSuccess { onPaired() }.onFailure { error = it.message }; busy = false } },
            label = { Text(if (busy) "…" else "Pair") }, colors = ChipDefaults.primaryChipColors(),
        )
        error?.let { Text(it, color = Color(0xFFE5484D), fontSize = 11.sp, textAlign = TextAlign.Center) }
    }
}

@Composable
private fun Label(text: String) = Text(text, color = Muted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
